const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middlewares //

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://flexipay-6694e.web.app",
      "https://flexipay-6694e.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

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
    const transcactionCollections = client
      .db("FlexiPay")
      .collection("transactions");
    const usersCollections = client.db("FlexiPay").collection("users");
    const notificationsCollections = client
      .db("FlexiPay")
      .collection("notification");
    const requestedAgentCollections = client
      .db("FlexiPay")
      .collection("requested-agents");
    const cashRequestedCollections = client
      .db("FlexiPay")
      .collection("cash-request");

    // JWT RELATED API //

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token) {
        return res.status(401).send({ message: "Unothorized User Access" });
      }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unothorized User Access" });
        }
        req.user = decoded;
        next();
      });
    };

    //GET USER INDIVIDUAL DATA //
    app.get("/users", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    //GET ALL TRANSACTIONS INDIVIDUAL DATA FOR USER //
    app.get("/transactions/Individual/user", verifyToken, async (req, res) => {
      const senderMobileNumber = req.query.senderMobileNumber;
      const query = { senderMobileNumber: Number(senderMobileNumber) };
      const result = await transcactionCollections.find(query).toArray();
      res.send(result);
    });
    //GET ALL TRANSACTIONS  DATA FOR AGENT //
    app.get("/transactions/Individual/agent", verifyToken, async (req, res) => {
      const mobileNumber = req.query.mobileNumber;
      const query = { mobileNumber: Number(mobileNumber) };
      const result = await transcactionCollections.find(query).toArray();
      res.send(result);
    });

    //GET ALL TRANSACTIONS DATA FOR ADMIN //
    app.get("/allRequestedAgent", verifyToken, async (req, res) => {
      const result = await requestedAgentCollections.find().toArray();
      res.send(result);
    });

    //GET ALL TRANSACTIONS INDIVIDUAL DATA FOR USER //
    app.get("/transactions/allTransactions", verifyToken, async (req, res) => {
      const result = await transcactionCollections.find().toArray();
      res.send(result);
    });

    // GET RECEIVER NOTIFICATION WHO GET THE MONEY //

    app.get("/notifications", verifyToken, async (req, res) => {
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

    // GET INDIVIDAUL USER WHO IS AGENT //

    app.get("/users/agent/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);

      let isAgent = false;
      if (user) {
        isAgent = user?.accountType === "Agent";
      }

      res.send({ isAgent });
    });
    // GET INDIVIDAUL USER WHO IS USER //

    app.get("/users/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);

      let isUser = false;
      if (user) {
        isUser = user?.accountType === "User";
      }

      res.send({ isUser });
    });
    // GET INDIVIDAUL USER WHO IS ADMIN //

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      let isAdmin = false;
      if (user) {
        isAdmin = user?.accountType === "Admin";
      }
      res.send({ isAdmin });
    });

    //GET ALL USERS DATA FOR ADMIN //
    app.get("/users/allUsers", verifyToken, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.send(result);
    });

    // GET ALL REQUEST FOR CASH FROM ADMIN //
    app.get("/allCashRequest", verifyToken, async (req, res) => {
      const result = await cashRequestedCollections.find().toArray();
      res.send(result);
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
      const result = await transcactionCollections.insertOne(req.body);

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

    // POST A CASH OUT //
    app.post("/cashout", async (req, res) => {
      const { senderId, amount, mobileNumber } = req.body;
      // Insert the transaction record
      const result = await transcactionCollections.insertOne(req.body);

      // Find sender by ID
      const sender = await usersCollections.findOne({
        _id: new ObjectId(senderId),
      });

      // Find receiver by mobileNumber
      const receiver = await usersCollections.findOne({
        mobileNumber: mobileNumber,
      });
      // Find the Agent
      const agent = await usersCollections.findOne({ accountType: "Agent" });
      // Find the Admin
      const admin = await usersCollections.findOne({ accountType: "Admin" });
      // Calculate transaction fees
      const totalFee = amount * 0.015;
      const agentFee = amount + amount * 0.01;
      const adminFee = amount * 0.005;
      const totalDeduction = amount + totalFee;
      // Update sender's balance (deduct money)
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
      // Update Agent's balance (add agentFee)
      const updatedAgentBalance = agent.myBalance + agentFee;
      await usersCollections.updateOne(
        { _id: new ObjectId(agent._id) },
        { $set: { myBalance: updatedAgentBalance } }
      );

      // Update Admin's balance (add adminFee)
      const updatedAdminBalance = admin.myBalance + adminFee;
      await usersCollections.updateOne(
        { _id: new ObjectId(admin._id) },
        { $set: { myBalance: updatedAdminBalance } }
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
        agentNewBalance: updatedAgentBalance,
        adminNewBalance: updatedAdminBalance,
        totalDeduction: totalDeduction,
        notificationResult: notificationResult,
      });
    });

    // POST A CASH IN //

    app.post("/cashIn", async (req, res) => {
      const { senderId, amount, mobileNumber } = req.body;
      // Insert the transaction record
      const result = await transcactionCollections.insertOne(req.body);

      // Find sender by ID
      const sender = await usersCollections.findOne({
        _id: new ObjectId(senderId),
      });

      // Find receiver by mobileNumber
      const receiver = await usersCollections.findOne({
        mobileNumber: mobileNumber,
      });

      // Update sender balance (deduct money)
      const updatedSenderBalance = Number(sender.myBalance) - Number(amount);
      await usersCollections.updateOne(
        { _id: new ObjectId(senderId) },
        { $set: { myBalance: updatedSenderBalance } }
      );

      // Update receiver balance (add money)
      const updatedReceiverBalance =
        Number(receiver.myBalance) + Number(amount);
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

    // POST A REQUEST AN AGENT //

    app.post("/requestedAgent", async (req, res) => {
      const requestedAgent = req.body;
      const result = await requestedAgentCollections.insertOne(requestedAgent);
      res.send(result);
    });

    // POST A REQUEST FOR CASH AS A AGENT //

    app.post("/cashRequest", async (req, res) => {
      const cashRequest = req.body;
      const result = await cashRequestedCollections.insertOne(cashRequest);
      res.send(result);
    });

    // PUT REQUEST AN AGENT STATUS //
    app.put("/requestedAgent/:id", async (req, res) => {
      const agentId = req.params.id;
      const { status } = req.body;
      const agent = await requestedAgentCollections.findOne({
        _id: new ObjectId(agentId),
      });
      agent.status = status;
      const result = await requestedAgentCollections.updateOne(
        { _id: new ObjectId(agentId) },
        { $set: { status: status } }
      );
      res.send(result);
    });
    // UPADTE AGENT BALANCE //
    app.put("/cashRequest/:id", async (req, res) => {
      const senderId = req.params.id;
      const { agentBalance } = req.body;
      // Update agentBalance in cashRequestedCollections
      const result = await cashRequestedCollections.updateOne(
        { agentId: senderId },
        { $set: { agentBalance: agentBalance } }
      );
      // Update myBalance in usersCollections
      const userUpdate = await usersCollections.updateOne(
        { _id: new ObjectId(senderId) },
        { $set: { myBalance: agentBalance } }
      );

      res.send({
        result: { modifiedCount: result.modifiedCount },
        userUpdate: { modifiedCount: userUpdate.modifiedCount },
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
