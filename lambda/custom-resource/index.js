const AWS = require('aws-sdk');
const wafv2 = new AWS.WAFV2({region: "us-east-1"}); 


exports.handler = async function(event) {
  try {
      switch (event.RequestType) {
        case "Create":
          const apikeys = await wafv2.listAPIKeys({ Scope: 'CLOUDFRONT' }).promise();
          console.log(apikeys);
          // todo chaange code when sdk is fixed
          var applicationIntegrationURL = apikeys.ApplicationIntegrationURL;
          if (!applicationIntegrationURL.includes("captcha-sdk")) {
            applicationIntegrationURL = applicationIntegrationURL.replace("sdk", "captcha-sdk")
          }
          applicationIntegrationURL = applicationIntegrationURL + "_/";
          
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
          return { 'PhysicalResourceId': event.PhysicalResourceId }
      }

  } catch (error) {
    console.log(error);
  }
  
};
