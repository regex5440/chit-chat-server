import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { signupTokenAuthority, tokenAuthority } from "@middlewares/auth";
import route from "./src/routes/router";
import { existsSync } from "fs";
import path from "path";
import { availableParallelism, platform } from "os";
import cluster from "cluster";
import { setupMaster, setupWorker } from "@socket.io/sticky";
import { setupPrimary, createAdapter } from "@socket.io/cluster-adapter";
import process from "process";
import sendEmail from "@utils/mailer";
import { mongoDbClient } from "@db/client";
import socketHandlers from "@lib/socker.io/routes";
import rClient from "@lib/redis";

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
    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died.`);
      console.log(`Current Online: ${Object.keys(cluster.workers as object).length}`);
    });
  } else {
    const expressApp = express();
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
    rClient.connect();
  }
} catch (e) {
  console.error("ServerError:", e);
}
