const express = require("express");
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_SECRET_PASS}@cluster0.ppdfwyq.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const allArticlesCollection = client
      .db("expressTimesDB")
      .collection("allArticles");
    const userCollection = client.db("expressTimesDB").collection("users");
    const publisherCollection = client
      .db("expressTimesDB")
      .collection("publisher");

    // JWT

    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res
          .status(401)
          .send({ message: "forbidden access - no token provided" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .send({ message: "forbidden access - invalid token" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        if (!isAdmin) {
          return res.status(403).send({ message: "forbidden access" });
        }
        next();
      } catch (error) {
        console.log(error);
      }
    };

    // publisher
    // publisher
    app.get("/publisher", async (req, res) => {
      try {
        const result = await publisherCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error getting publisher data:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/publisher", verifyToken, async (req, res) => {
      try {
        const publisher = req.body;
        const result = await publisherCollection.insertOne(publisher);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // user Related api

    app.get("/users", verifyToken, async (req, res) => {
      try {
        console.log(req.headers);
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ massage: "user already exists", insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.log("Error User Create", error);
      }
    });

    app.patch("/users/admin/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.delete("/users/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // Article Related
    app.post("/allArticles", async (req, res) => {
      try {
        const articleData = req.body;
        const result = await allArticlesCollection.insertOne(articleData);
        res.send(result);
      } catch (error) {
        console.error("Error creating article:", error);
      }
    });

    app.get("/allArticles", async (req, res) => {
      try {
        const result = await allArticlesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error get article:", error);
      }
    });

    app.get("/allArticles/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await allArticlesCollection.findOne(query);
        if (result) {
          res.send(result);
        } else {
          res.status(404).send("Articles not found");
        }
      } catch (error) {
        console.log("Error single article", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.delete("/allArticles/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await allArticlesCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log("Error Delete article", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.patch("/allArticles/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const article = await allArticlesCollection.findOne(filter);
        if (req.body.incrementView) {
          const updatedDoc = {
            $set: { view: parseInt(article.view || 0) + 1 },
          };
          const result = await allArticlesCollection.updateOne(
            filter,
            updatedDoc
          );
          return res.send(result);
        }
        const updatedDoc = {
          $set: {
            title: req.body.title,
            timeZone: req.body.timeZone,
            area: req.body.area,
            category: req.body.category,
            packageDescription: req.body.packageDescription,
          },
        };
        const result = await allArticlesCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      } catch (error) {
        console.log("Error Update article", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SERVER IS RUNNING PORT");
});

app.listen(port, () => {
  console.log(`SERVER IS RUNNING PORT ON ${port}`);
});
