import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { signupTokenAuthority, tokenAuthority } from "./src/middlewares/auth";
import route from "./src/routes/router";
import { existsSync } from "fs";
import path from "path";
import { availableParallelism, platform } from "os";
import cluster from "cluster";
import { setupMaster, setupWorker } from "@socket.io/sticky";
import { setupPrimary, createAdapter } from "@socket.io/cluster-adapter";
import process from "process";
import sendEmail from "./src/utils/mailer";
import { mongoDbClient } from "./src/db/client";
import socketHandlers from "@utils/library/socker.io/routes";

const corsPolicy: cors.CorsOptions | cors.CorsOptionsDelegate | undefined = {
  origin: process.env.Client_URL?.includes(",") ? process.env.Client_URL.split(",") : process.env.Client_URL,
  credentials: true,
};

try {
  if (!(process.env.DB_UserName || process.env.DB_PassWord)) throw new Error("DB_UserName or DB_PassWord is not defined");
  if (cluster.isPrimary) {
    const allCores = availableParallelism();
    const availableCores = process.env.WORKER_LIMIT !== undefined ? Number(process.env.WORKER_LIMIT) : allCores;
    console.log("Platform: %s", platform());
    console.log("Primary process...");
    console.log("Starting %d workers out of %d available cores", availableCores, allCores);
    const PORT = process.env.PORT || 5000;
    const httpServer = createServer();
    setupMaster(httpServer, {
      loadBalancingMethod: "least-connection",
    });
    setupPrimary();
    cluster.setupPrimary({ serialization: "advanced" });
    if (availableCores > 1) {
      console.log("Creating clusters");
      for (let i = 0; i < availableCores; i++) {
        cluster.fork();
      }
    }
    let currentOnline = 0;
    cluster.on("online", (worker) => {
      console.log(`Online: ${worker.process.pid}`);
      currentOnline++;
      if (currentOnline === availableCores) {
        httpServer.listen(PORT, () => {
          console.log("Server started at", PORT);
        });
      }
    });

    let cannotWakeEmailSendCount = 0;
    const x = setInterval(
      //! PREVENT SERVER FROM SLEEPING (RENDER)
      () => {
        fetch("https://cc.api.hdxdev.in/dont_sleep")
          .then((response: any) => {
            if (response.status === 202) {
              console.log("Prevented from sleep");
            } else {
              throw new Error("Not receiving response.Receiver" + response.text);
            }
          })
          .catch((e) => {
            if (cannotWakeEmailSendCount === 3) {
              clearInterval(x);
            }
            cannotWakeEmailSendCount++;
            if (process.env.EMAIL_ALERT_TO) {
              sendEmail({
                to: process.env.EMAIL_ALERT_TO,
                subject: "Chit-Chat server is offline!",
                html: `
                <div style="margin:auto;width: fit-content;">
                <h2 style="text-align:center; color: red;">Chit-Chat is down, Please check the deployment!</h2>
                <div style="border:1px solid black; border-radius: 5px">Error:
                <code>${JSON.stringify(e)}</code>
                </div>
                </div>`,
              });
            }
            console.log("Cannot wake up", e);
          });
      },
      1000 * 60 * 10,
    );
    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died.`);
      console.log(`Current Online: ${Object.keys(cluster.workers as object).length}`);
    });
  } else {
    const expressApp = express();
    //TODO: Separate the socket.io server to a different file
    const server = createServer(expressApp);
    const io = new Server(server, {
      cors: corsPolicy,
    });
    io.adapter(createAdapter());
    setupWorker(io);
    // Socket
    io.on("connection", socketHandlers);
    expressApp.use(cors(corsPolicy));
    expressApp.use(express.json());
    expressApp.use(express.raw({ limit: "1mb" }));

    //After email verification, use this API
    expressApp.use("/signup/api", signupTokenAuthority);
    // Authenticated Login Endpoints
    expressApp.use("/api", tokenAuthority);

    expressApp.use(route);

    //Assets
    expressApp.get("/assets/:assetId", async (req, res) => {
      const assetID = req.params.assetId;
      const IconsPath = path.resolve(__dirname, "icons");
      let fileName = "";
      switch (assetID) {
        case "chit-chat-logo-regular":
          fileName = "chit-chat-logo.jpg";
          break;
        default:
          fileName = "invalid-file";
      }
      if (existsSync(path.join(IconsPath, fileName))) {
        res.sendFile(path.join(IconsPath, fileName));
      } else {
        res.status(404).send("Not Found!");
      }
    });
    mongoDbClient.connect().then(() => {
      console.log("Worker %d connected with db", process.pid);
    });
  }
} catch (e) {
  console.error("ServerError:", e);
}
