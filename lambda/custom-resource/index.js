const AWS = require('aws-sdk');
const wafv2 = new AWS.WAFV2({region: "us-east-1"}); 


exports.handler = async function(event) {
  try {
      switch (event.RequestType) {
        case "Create":
          const apikeys = await wafv2.listAPIKeys({ Scope: 'CLOUDFRONT' }).promise();

          var applicationIntegrationURL = apikeys.ApplicationIntegrationURL;
          console.log(applicationIntegrationURL);
          applicationIntegrationURL = applicationIntegrationURL + "jsapi.js";
          
          var keyFound = false;
          var selectedKey;
          for (const key of apikeys.APIKeySummaries) {

            for (const domain of key.TokenDomains) {
                console.log(domain);
                if (domain === event.ResourceProperties.Domain) {
                  keyFound = true;
                  selectedKey = key.APIKey;
                  console.log("found");
                }
            }
          }
    
          if (!keyFound) {
            const response = await wafv2.createAPIKey({ TokenDomains: [event.ResourceProperties.Domain], Scope: 'CLOUDFRONT'}).promise();
            selectedKey = response.APIKey;
            console.log("new key created", selectedKey);
          }    
          return { 'Data': { 'APIKey': selectedKey, 'CaptchaIntegrationURL': applicationIntegrationURL } } 
        case "Update":
        case "Delete":
          return { 'PhysicalResourceId': event.PhysicalResourceId } // WHEN key deletion is available in WAFv2 API, modify this section.
      }

  } catch (error) {
    console.log(error);
  }
  
};
