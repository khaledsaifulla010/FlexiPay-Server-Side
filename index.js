const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
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
      const query = req.body;
      const result = await sendMoneyCollections.insertOne(query);
      res.send(result);
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
