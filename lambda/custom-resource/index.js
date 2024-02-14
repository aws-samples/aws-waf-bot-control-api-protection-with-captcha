const AWS = require('aws-sdk');
const wafv2 = new AWS.WAFV2({region: "us-east-1"}); 

exports.handler = async function(event) {
  try {
      switch (event.RequestType) {
        case "Create":
          var selectedKey = await getAPIKey(event.ResourceProperties.Domain);

          if (!selectedKey) {
            const response = await wafv2.createAPIKey({ TokenDomains: [event.ResourceProperties.Domain], Scope: 'CLOUDFRONT'}).promise();
            selectedKey = response.APIKey;
            console.log("new key created", selectedKey);
          }    
          return { 'Data': { 'APIKey': selectedKey, 'CaptchaIntegrationURL': applicationIntegrationURL } } 
        case "Update":
          return { 'PhysicalResourceId': event.PhysicalResourceId }
        case "Delete":
          var selectedKey = await getAPIKey(event.ResourceProperties.Domain);
      
          if (selectedKey) {
            const response = await wafv2.deleteAPIKey({ APIKey: selectedKey, Scope: 'CLOUDFRONT'}).promise();
            selectedKey = response.APIKey;
            console.log(" key deleted", selectedKey);
          }    

          return { 'PhysicalResourceId': event.PhysicalResourceId }
      }

  } catch (error) {
    console.log(error);
  }
  
};


async function getAPIKey(CFdomain) {

const apikeys = await wafv2.listAPIKeys({ Scope: 'CLOUDFRONT' }).promise();

  console.log(apikeys);

  var applicationIntegrationURL = apikeys.ApplicationIntegrationURL;
  console.log(applicationIntegrationURL);
  applicationIntegrationURL = applicationIntegrationURL + "jsapi.js";

  var selectedKey;
  for (const key of apikeys.APIKeySummaries) {

    for (const domain of key.TokenDomains) {
        console.log(domain);
        if (domain === CFdomain) {
          selectedKey = key.APIKey;
          console.log("found");
        }
    }
  }

  return selectedKey;
}
