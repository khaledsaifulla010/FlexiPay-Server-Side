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

    //GET USER INDIVIDUAL DATA //
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    // POST A NEW USER //
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { mobileNumber: user.mobileNumber };
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
      const { senderId, amount } = req.body;

      const result = await sendMoneyCollections.insertOne(req.body);
      const sender = await usersCollections.findOne({
        _id: new ObjectId(senderId),
      });
      const transactionFee = amount > 100 ? 5 : 0;
      const totalDeduction = amount + transactionFee;

      const updatedBalance = sender.myBalance - totalDeduction;
      const updateResult = await usersCollections.updateOne(
        { _id: new ObjectId(senderId) },
        { $set: { myBalance: updatedBalance } }
      );
      if (updateResult.modifiedCount > 0) {
        res.send({ success: true, newBalance: updatedBalance });
      } else {
        res.status(500).send({ error: "Balance update failed!" });
      }
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
