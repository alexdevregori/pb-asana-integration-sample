// noinspection JSUnresolvedVariable

// Node packages being used
// const xslt = require("./transform.js");
const express = require("express"); // Node.js web application framework
const bodyParser = require("body-parser"); // Parses JSON bodies
const app = express().use(bodyParser.text()); // Used to make request to your server
const port = process.env.PORT || 3001; // Port used for development
const axios = require("axios"); // Sends HTTP requests
const crypto = require("crypto");
const SaxonJS = require("saxon-js"); // Pareses through Productboard XML to conform to Asana's rich text restrictions
const asana = require("asana"); // A JavaScript client (for both Node and browser) for the Asana API v1.0.

// Configuration of our server
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Productboard information
const PRODUCTBOARD_INTEGRATION_ID = "integration ID"; // Productboard plugin integration ID
const PRODUCTBOARD_TOKEN =
  "Bearer token"
//Asana information
const ASANA_TOKEN = "Asana token";
const ASANA_WORKSPACE_ID = "workspace ID";
const client = asana.Client.create().useAccessToken(ASANA_TOKEN);

const xslt = `<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0">
<xsl:output method="html" omit-xml-declaration="yes" indent="yes"/>
  <xsl:mode on-no-match="text-only-copy"/>
  <xsl:template match="h1">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="h2">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="b">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="b">
    <strong><xsl:apply-templates/></strong>
  </xsl:template>
  <xsl:template match="i">
    <em><xsl:apply-templates/></em>
  </xsl:template>
  <xsl:template match="u">
    <u><xsl:apply-templates/></u>
  </xsl:template>
  <xsl:template match="pre">
    <code><xsl:apply-templates/></code>
  </xsl:template>
  <xsl:template match="u">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="code">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="ol">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="ul">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="li">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="s">
    <xsl:copy>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="a">
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:copy>
</xsl:template>
</xsl:stylesheet>`;

// Initial route to confirm app is running
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Route to authenticate plugin connection. More info here: https://developer.productboard.com/#tag/pluginIntegrations
app.get("/plugin", async (req, res) => {
  res.setHeader("Content-type", "text/plain");
  res.status(200).send(req.query.validationToken);
});

// Endpoint where POST requests from Productboard plugin will be sent. More info here: https://developer.productboard.com/#operation/postPluginIntegration
app.post("/plugin", async (req, res) => {
  // Gather information about the Productboard feature that is sending over the request
  const pbFeatureID = req.body.data.feature.id;
  const pbFeatureLink = req.body.data.feature.links.html;

  console.log("Productboard trigger is:", req.body.data.trigger);

  // Determine action on button trigger. Can be push, dismiss, or unlink.
  if (req.body.data.trigger === "button.push") {
    res.json({
      data: {
        connection: {
          state: "progress",
        },
      },
    });

    // Get data about Productboard feature getting pushed
    getProductboardFeature(pbFeatureID).then((pbFeatureResponse) => {
      // Extract data about Productboard feature
      const featureName = pbFeatureResponse.data.data.name;
      const featureDescription = `<body>${pbFeatureResponse.data.data.description}</body>`;
      console.log("PB Feature description is: ", featureDescription);

      const featureLinkHtml = `<br><strong>Click <a href="${pbFeatureLink}" target="_blank">here</a> to see feature in Productboard</strong>`;
      console.log(`Productboard feature name is: ${featureName}`);

      var featureDescriptionResult = SaxonJS.XPath.evaluate(
        `transform(
        map {
          'source-node' : parse-xml-fragment($xml),
          'stylesheet-text' : $xslt,
          'delivery-format' : 'serialized'
          }
      )?output`,
        [],
        {
          params: {
            xml: featureDescription,
            xslt: xslt,
          },
        }
      );

      console.log(featureDescriptionResult);

      createAsanaTask(featureName, featureDescriptionResult)
        .then((asanaTaskResponse) => {
          console.log(asanaTaskResponse);
          const taskID = asanaTaskResponse.data.data.gid;
          const taskURL = asanaTaskResponse.data.data.permalink_url;
          console.log(`Asana task ID is: ${taskID}`);

          // Connect feature and issue
          createProductboardPluginIntegrationConnection(pbFeatureID, taskID, taskURL)
            .then((_) => console.log("Productboard feature connected to Asana issue."))
            .catch((error) =>
              console.log(
                "Error when connecting Productboard feature and Asana task:",
                error.response.data
              )
            );
        })
        .catch((error) => console.log("Error when getting Productboard feature:", error.response));
    });
  } else {
    // If button trigger is unlink or dismiss, set PB plugin connection to initial state (i.e. disconnected)
    res.json({
      data: {
        connection: {
          state: "initial",
        },
      },
    });
    console.log("Productboard feature is unlinked");
  }

  res.status(200).end();
});

let secret = "0d9c202028054df432584f4896271a1a";

app.post("/receiveWebhook", (req, res) => {
  if (req.headers["x-hook-secret"]) {
    console.log("This is a new webhook");
    secret = req.headers["x-hook-secret"];
    console.log(secret);

    res.setHeader("X-Hook-Secret", secret);
    res.sendStatus(200);
  } else if (req.headers["x-hook-signature"]) {
    console.log(req.headers);
    console.log(secret);
    const computedSignature = crypto
      .createHmac("SHA256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(req.headers["x-hook-signature"]),
        Buffer.from(computedSignature)
      )
    ) {
      // Fail
      console.log("Unauthorized request");
      res.sendStatus(401);
    } else {
      // Success
      res.sendStatus(200);
      console.log(`Events on ${Date()}:`);
      console.log(req.body.events[0]);

      asanaEvent = req.body.events[0];
      if (asanaEvent) {
        const asanaTaskID = asanaEvent.resource.gid;
        getAsanaTask(asanaTaskID)
          .then((asanaTaskResponse) => {
            console.log("Asana response is:", asanaTaskResponse.data);

            const asanaTaskStatus = asanaTaskResponse.data.data.completed;
            let offset = 0;
            let pbFeatureLink = [];
            console.log("pbFeatureLink length is ", pbFeatureLink.length);
            while (pbFeatureLink.length === 0) {
              try {
                getProductboardPluginIntegrationsConnections(offset)
                  .then((pbFeatureConnections) => {
                    console.log("here");
                    const pbData = pbFeatureConnections.json();
                    const pbDataIDs = pbData.data;
                    pbFeatureLink = pbDataIDs.filter((obj) => {
                      return obj.connection.issueId === asanaTaskID;
                    });
                    console.log("Page offset reached", offset);
                    offset += 100;
                    if (pbData.data.length === 0) {
                      return;
                    }
                  })
                  .catch((error) =>
                    console.log(
                      "Error when getting Productboard plugin connections:",
                      error.response.data
                    )
                  );
                if (pbFeatureLink.length === 1) {
                  const pbFeatureID = pbFeatureLink[0].featureId;
                  // Send request to PB with Asana information
                  updateProductboardPluginIntegrationConnection(
                    pbFeatureID,
                    asanaTaskID,
                    asanaTaskStatus
                  );
                }
              } catch (e) {
                console.log("Plugin update error is", e);
              }
            }
          })
          .catch((error) => console.log("Error when getting Asana task info:", error.response));
      }
    }
  } else {
    console.error("Something went wrong!");
  }
});

// Initiating server to listen for requests from PB
app.listen(port, () => {
  console.log(`Example app listening on https://pb-test.ngrok.io`);
});

// Functions below for HTTP requests used in integration

// Structure for Axios requests sent to PB API. More info here: https://developer.productboard.com/#section/Introduction
function sendProductboardRequest(method, url, data = undefined) {
  return axios({
    method: method,
    url: `https://api.productboard.com/${url}`,
    headers: {
      "X-Version": "1",
      Authorization: PRODUCTBOARD_TOKEN,
      "Content-Type": "application/json",
    },
    data: data,
  });
}

// Get Productboard feature information
function getProductboardFeature(featureId) {
  return sendProductboardRequest("get", `features/${featureId}`);
}

function createAsanaTask(name, notes) {
  const asanaTaskData = JSON.stringify({
    data: {
      name: name,
      html_notes: `<body>${notes}</body>`,
      workspace: ASANA_WORKSPACE_ID,
      pretty: true,
    },
  });

  return sendAsanaRequest("post", "tasks", asanaTaskData);
}

function getAsanaTask(asanaTaskID) {
  return sendAsanaRequest("get", `tasks/${asanaTaskID}`);
}

function sendAsanaRequest(method, url, data = undefined) {
  return axios({
    method: method,
    url: `https://app.asana.com/api/1.0/${url}`,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ASANA_TOKEN}`,
      "Content-Type": "application/json",
    },
    data: data,
  });
}

function createProductboardPluginIntegrationConnection(featureID, taskID, taskURL) {
  const pbPluginIntegrationData = JSON.stringify({
    data: {
      connection: {
        state: "connected",
        label: "Opened",
        hoverLabel: `ID ${taskID}`,
        tooltip: `ID: ${taskID}`,
        color: "blue",
        targetUrl: taskURL,
      },
    },
  });
  return sendProductboardRequest(
    "put",
    `plugin-integrations/${PRODUCTBOARD_INTEGRATION_ID}/connections/${featureID}`,
    pbPluginIntegrationData
  );
}

// Update a plugin integration connection. More info here: https://developer.productboard.com/#operation/putPluginIntegrationConnection
function updateProductboardPluginIntegrationConnection(featureID, taskID, taskStatus, taskURL) {
  const pbPluginIntegrationData = JSON.stringify({
    data: {
      connection: {
        state: "connected",
        label: taskStatus,
        hoverLabel: `ID: ${taskID}`,
        tooltip: `ID: ${taskID}`,
        color: issueStatus === "opened" ? "blue" : "green",
        targetUrl: taskURL,
      },
    },
  });

  return sendProductboardRequest(
    "put",
    `plugin-integrations/${PRODUCTBOARD_INTEGRATION_ID}/connections/${featureID}`,
    pbPluginIntegrationData
  );
}

// Get specific plugin integration data. More info here: https://developer.productboard.com/#operation/getPluginIntegrationConnection
function getProductboardPluginIntegrationsConnections(offset) {
  return sendProductboardRequest(
    "get",
    `plugin-integrations/${PRODUCTBOARD_INTEGRATION_ID}/connections/?pageLimit=100&pageOffset=${offset}`
  );
}
