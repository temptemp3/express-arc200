// app.js
import express from "express";
import algosdk from "algosdk";
import arc200 from "arc200js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 5002;

// Your Algod API token
const algodToken = process.env.ALGOD_TOKEN || "";
// Address of your Algod node
const algodServer = process.env.ALGOD_URL || "";
// Port of your Algod node
const algodPort = process.env.ALGOD_PORT || "";

// Print the values to verify that all env variables are set
console.log({ algodToken, algodServer, algodPort });

// Initialize an algodClient
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

// Helper function to prepare string
const prepareString = (str) => {
  const index = str.indexOf("\x00");
  if (index > 0) {
    return str.slice(0, str.indexOf("\x00"));
  } else {
    return str;
  }
};

// Middleware to check if tokenId is a valid number
const validateTokenId = (req, res, next) => {
  const { tokenId } = req.params;

  if (!Number.isNaN(Number(tokenId))) {
    next();
  } else {
    res
      .status(400)
      .json({ success: false, error: "Invalid tokenId. Must be a number." });
  }
};

// Define a helper function to handle common error responses
function handleErrorResponse(res, error) {
  console.error(error);
  res.status(500).json({ success: false, error: "Internal Server Error" });
}

// Define a common route handler for ABI methods
async function handleAbiMethod(req, res, methodName) {
  try {
    const { tokenId } = req.params;
    const arc200Instance = new arc200(Number(tokenId), algodClient);
    const { success, returnValue } = await arc200Instance[methodName]();

    if (success) {
      res.json({ success: true, response: prepareString(returnValue) });
    } else {
      res.status(404).json({ success: false, error: "Token not found" });
    }
  } catch (error) {
    handleErrorResponse(res, error);
  }
}

// Define a route
app.get("/api", (req, res) => {
  res.send("Hello, World!");
});

// Routes for each ABI method with updated paths
app.get("/api/assets/:tokenId/name", validateTokenId, async (req, res) => {
  await handleAbiMethod(req, res, "arc200_name");
});

app.get("/api/assets/:tokenId/symbol", validateTokenId, async (req, res) => {
  await handleAbiMethod(req, res, "arc200_symbol");
});

app.get("/api/assets/:tokenId/totalSupply", validateTokenId, async (req, res) => {
  await handleAbiMethod(req, res, "arc200_totalSupply");
});

app.get("/api/assets/:tokenId/decimals", validateTokenId, async (req, res) => {
  await handleAbiMethod(req, res, "arc200_decimals");
});

app.get("/api/assets/:tokenId", validateTokenId, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const arc200Instance = new arc200(Number(tokenId), algodClient);
    const nameResponse = await arc200Instance.arc200_name();
    const symbolResponse = await arc200Instance.arc200_symbol();
    const totalSupplyResponse = await arc200Instance.arc200_totalSupply();
    const decimalsResponse = await arc200Instance.arc200_decimals();

    if (
      nameResponse.success &&
      symbolResponse.success &&
      totalSupplyResponse.success &&
      decimalsResponse.success
    ) {
      const combinedResponse = {
        asset: {
          index: tokenId,
          name: prepareString(nameResponse.returnValue),
          symbol: prepareString(symbolResponse.returnValue),
          totalSupply: `${totalSupplyResponse.returnValue}`,
          decimals: `${decimalsResponse.returnValue}`,
        },
      };

      res.json({ success: true, response: combinedResponse });
    } else {
      res.status(404).json({ success: false, error: "Token not found" });
    }
  } catch (error) {
    handleErrorResponse(res, error);
  }
});

app.get(
  "/api/assets/:tokenId/transfer/:addrFrom/:addrTo/:amt",
  validateTokenId,
  async (req, res) => {
    try {
      const { tokenId, addrFrom, addrTo, amt } = req.params;
      const arc200Instance = new arc200(
        Number(tokenId),
        algodClient,
        { addr: addrFrom },
      );
      const transferResponse = await arc200Instance.arc200_transfer(
        addrTo,
        Number(amt),
      );
      if (transferResponse.success) {
        res.json({ success: true, response: transferResponse.txns });
      } else {
        res.status(400).json({
          success: false,
          error: "Transfer failed",
          details: transferResponse.error,
        });
      }
    } catch (error) {
      handleErrorResponse(res, error);
    }
  }
);

// Start the server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

export default app;