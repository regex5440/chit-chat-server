import { ObjectId } from "mongodb";
import { MessageObject, MessageUpdate } from "../../@types";
import { getPostSignedURL, removeAsset } from "../utils/library/cloudflare";
import db from "../db/client";

const chatsCollection = db.collection("chats");

async function getChat(chatIds: ObjectId[] = [], initialMessagesCount = 20) {
  return await chatsCollection //*  Providing chat data with last 20 messages
    .find(
      { _id: { $in: chatIds } },
      {
        projection: {
          _id: 0,
          chat_id: "$_id",
          participants: 1,
          last_updated: 1,
          created_at: 1,
          authors_typing: 1,
          messages: { $slice: ["$messages", -1 * initialMessagesCount] },
          created_by: 1,
        },
      },
    )
    .toArray();
}

/**
 *
 * @param chatId Chat Id in string
 * @param count Number of messages user has
 * @param messagesCount Number of messages user is requesting
 */
async function getMessages(chatId: string, count = 20, messagesCount = 50) {
  const data = await chatsCollection
    .aggregate([
      {
        $match: {
          _id: new ObjectId(chatId),
        },
      },
      {
        $addFields: {
          messageCount: { $size: "$messages" },
        },
      },
      {
        $addFields: {
          offset: {
            $subtract: ["$messageCount", count],
          },
          pageSize: {
            $min: [{ $subtract: ["$messageCount", count] }, messagesCount],
          },
        },
      },
      {
        $project: {
          _id: 0,
          messages: {
            $slice: ["$messages", { $subtract: ["$offset", "$pageSize"] }, "$pageSize"],
          },
          hasMore: { $gt: ["$offset", "$pageSize"] },
        },
      },
    ])
    .toArray();
  if (!data?.[0]) return {};

  return data[0];
}

async function createNewChat(creatorId: string, messageObject: MessageObject | null = null) {
  if (messageObject) {
    messageObject.timestamp = new Date();
    messageObject.id = new ObjectId();
    messageObject.seenByRecipients = [];
  }
  const newChat = await chatsCollection.insertOne({
    authors_typing: [],
    created_at: new Date(),
    last_updated: new Date(),
    messages: messageObject ? [messageObject] : [],
    participants: [new ObjectId(creatorId)],
    created_by: new ObjectId(creatorId),
  });
  return newChat;
}

async function addMessage(chat_id: string, messageObject: MessageObject) {
  const id = new ObjectId();
  await chatsCollection.updateOne(
    { _id: new ObjectId(chat_id) },
    {
      $push: { messages: { ...messageObject, id } },
      $set: { last_updated: messageObject.timestamp },
    },
  );
  return id.toString();
}
async function updateSeenMessages(chat_id: string, seenById: string, messageId: string) {
  return await chatsCollection.updateOne(
    {
      _id: new ObjectId(chat_id),
      "messages.id": new ObjectId(messageId),
    },
    {
      $addToSet: {
        "messages.$.seenByRecipients": new ObjectId(seenById),
      },
    },
  );
}

async function acceptMessageRequest(chatId: string, accepterId: string) {
  return chatsCollection.updateOne(
    {
      _id: new ObjectId(chatId),
    },
    {
      $push: {
        participants: new ObjectId(accepterId),
      },
    },
  );
}

async function deleteMessage(chatId: string, messageId: string, fromId: string, forAll = false, attachments: string[]) {
  let params: any = [
    {
      _id: new ObjectId(chatId),
      "messages.id": new ObjectId(messageId),
    },
    {
      $addToSet: {
        "messages.$.deletedFor": new ObjectId(fromId),
      },
    },
  ];
  if (forAll) {
    params = [
      {
        _id: new ObjectId(chatId),
      },
      {
        $pull: {
          messages: { id: new ObjectId(messageId), sender_id: fromId },
        },
      },
    ];
    if (attachments) {
      await removeAsset(attachments);
    }
  }
  return chatsCollection.updateOne(params[0], params[1]);
}

async function updateMessage(chatId: string, messageId: string, update: MessageUpdate, fromId: string) {
  return chatsCollection.updateOne(
    {
      _id: new ObjectId(chatId),
    },
    {
      $set: {
        "messages.$[message].text": update.text,
        "messages.$[message].edited": true,
      },
    },
    {
      arrayFilters: [
        {
          "message.id": new ObjectId(messageId),
          "message.sender_id": fromId,
        },
      ],
    },
  );
}

async function emptyChatMessages(chatId: string) {
  return chatsCollection.updateOne(
    {
      _id: new ObjectId(chatId),
    },
    {
      $set: {
        messages: [],
      },
    },
  )
}

async function deleteChat(chatId: string) {
  return chatsCollection.deleteOne({
    _id: new ObjectId(chatId),
  });
}

async function provideSignedURL(
  chat_id: string,
  filesInfo: {
    name: string;
    size: number;
  }[],
) {
  const filesWithSignedURL: {
    signed_url: string;
    key: string;
    file_name: string;
  }[] = [];
  for (const file of filesInfo) {
    const fileID = new ObjectId();
    const fileExtension = file.name.match(/\.[0-9a-z]+$/i)?.[0] || "";
    const path = `chat_${chat_id}`;
    const key = `cc_${fileID}${fileExtension}`;
    const url = await getPostSignedURL(`${path}/${key}`, "attachment", 10);
    filesWithSignedURL.push({
      signed_url: url,
      key: `${path}/${key}`,
      file_name: file.name,
    });
  }
  return filesWithSignedURL;
}

export {
  // Functions
  addMessage,
  createNewChat,
  deleteChat,
  deleteMessage,
  emptyChatMessages,
  updateMessage,
  updateSeenMessages,
  acceptMessageRequest,
  getChat,
  getMessages,

  // Cloudflare
  provideSignedURL,
};
