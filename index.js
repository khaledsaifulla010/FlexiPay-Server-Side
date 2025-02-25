const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middlewares //

app.use(cors());
app.use(express.json());

// Connect With MongoDB //
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ugbxhsw.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const sendMoneyCollections = client.db("FlexiPay").collection("send-money");
    const usersCollections = client.db("FlexiPay").collection("users");
    const notificationsCollections = client
      .db("FlexiPay")
      .collection("notification");

    //GET USER INDIVIDUAL DATA //
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    //GET SEND MONEY INDIVIDUAL DATA //
    app.get("/sendMoney", async (req, res) => {
      const mobileNumber = req.query.mobileNumber;
      const query = { mobileNumber: Number(mobileNumber) };
      const result = await sendMoneyCollections.find(query).toArray();
      res.send(result);
    });

    // GET RECEIVER NOTIFICATION WHO GET THE MONEY //

    app.get("/notifications", async (req, res) => {
      const { receiverId } = req.query;
      if (!receiverId || receiverId.length !== 24) {
        return res.status(400).send({ error: "Invalid receiver ID" });
      }
      const notifications = await notificationsCollections
        .find({ receiverId: new ObjectId(receiverId) })
        .sort({ date: -1 })
        .toArray();

      res.send(notifications);
    });

    // POST A NEW USER //
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollections.findOne(query);
      if (existingUser) {
        res.send({ message: "User already exists", insertedId: null });
      } else {
        const result = await usersCollections.insertOne(user);
        res.send(result);
      }
    });

    // POST A SEND MONEY //

    app.post("/sendMoney", async (req, res) => {
      const { senderId, amount, mobileNumber } = req.body;
      // Insert the transaction record
      const result = await sendMoneyCollections.insertOne(req.body);

      // Find sender by ID
      const sender = await usersCollections.findOne({
        _id: new ObjectId(senderId),
      });

      // Find receiver by mobileNumber
      const receiver = await usersCollections.findOne({
        mobileNumber: mobileNumber,
      });

      // Calculate transaction fee
      const transactionFee = amount > 100 ? 5 : 0;
      const totalDeduction = amount + transactionFee;

      // Update sender balance (deduct money)
      const updatedSenderBalance = sender.myBalance - totalDeduction;
      await usersCollections.updateOne(
        { _id: new ObjectId(senderId) },
        { $set: { myBalance: updatedSenderBalance } }
      );

      // Update receiver balance (add money)
      const updatedReceiverBalance = receiver.myBalance + amount;
      await usersCollections.updateOne(
        { mobileNumber: mobileNumber },
        { $set: { myBalance: updatedReceiverBalance } }
      );
      //  Save Notification in Database
      const notificationResult = await notificationsCollections.insertOne({
        receiverId: receiver._id,
        senderName: sender.name,
        amount: amount,
        message: `You have received ${amount} from ${sender.name}`,
        date: new Date(),
        isRead: false,
      });
      res.send({
        success: true,
        senderNewBalance: updatedSenderBalance,
        receiverNewBalance: updatedReceiverBalance,
        notificationResult: notificationResult,
      });
    });
  } finally {
  }
}
run().catch(console.dir);

// Server Running //

app.get("/", (req, res) => {
  res.send("FlexiPay Server is Running");
});

app.listen(port, () => {
  console.log(`FlexiPay Server is Running on ${port}`);
});
