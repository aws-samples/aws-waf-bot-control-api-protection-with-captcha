
import { helperCustomResource } from './custom-resource';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as waf from "aws-cdk-lib/aws-wafv2";
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

const html = `
<html>
<head><title>What is my IP address?</title></head>
<script type="text/javascript" src="CAPTCHAURLPLACEHOLDERjsapi.js" defer></script>

<style>
  .header {
      background-color: #0066cc;
      width: "100%";
      font-family: "Verdana";
      color: white;
      font-size: xxx-large;
      text-align: center;
      padding-top: 20px;
      padding-bottom: 20px;
  }

  .ui {
      background-color: #3489dd;
      width: "100%";
  }
 
.button {
  height: 60px;
}

.buttonContainer {
  height: 500px;
  padding-left: 10px;
  padding-right: 30px;
}

#container {
    font-family: "Verdana";
    color: white;
    font-size: large;
}
</style>

<body>

<div class="header">What is my IP address?</div>
<div class="ui">
  <table>
    <tr>
    <td class="buttonContainer"><button class="button" onclick="userAction()">Lookup IP</button></td>
    <td><p id="container"></p></td>
  </tr>
  </table>
</div>

<script>
    function showMyCaptcha() {
        const container = document.getElementById("container");
        AwsWafCaptcha.renderCaptcha(container, {
          apiKey: "APIKEYPLACEHOLDER",
            onSuccess: captchaExampleSuccessFunction,
            onError: captchaExampleErrorFunction,
        });
    }
    
    function userAction() {
      const container = document.getElementById('container');
      container.innerHTML = "";
      AwsWafIntegration.fetch('api/').then(response => {
        if (response.status == 200) {
          response.json().then(myJson => {
            container.innerHTML = "Your IP address is " + myJson.ip + ", and you are coming from " + myJson.country + ". The request id associated with this api call is " + myJson.requestid;
          });
        } else if (response.status == 405) {
          showMyCaptcha();
        }
        else {
          container.innerHTML = "Error retreiving IP info, HTTP response code: " + response.status;
        }
      });
    }
    
    function captchaExampleSuccessFunction() {
      const container = document.getElementById('container');
      container.innerHTML = "";
      AwsWafIntegration.fetch('api/').then(response => {
        response.json().then(myJson => {
          container.innerHTML = "Your IP address is " + myJson.ip + ", and you are coming from " + myJson.country + ". The request id associated with this api call is " + myJson.requestid;
        });
      });
    }

    function captchaExampleErrorFunction(error) {
       console.log(error);
    }
</script>

</body>
</html>
`;
export class SpaCrossDomainWafStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

        const path = require('node:path');
        const lamdaFunction = new lambda.Function(this, 'lamdaFunction', {
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/origin')),
            architecture: lambda.Architecture.X86_64,
        });
        const api = new apiGateway.RestApi(this, "api", {
            endpointConfiguration: {
                types: [apiGateway.EndpointType.REGIONAL]
            }
        });
        const nextCdkFunctionIntegration = new apiGateway.LambdaIntegration(lamdaFunction, {
            allowTestInvoke: false
        });
        api.root.addMethod('ANY', nextCdkFunctionIntegration);
        api.root.addProxy({
            defaultIntegration: new apiGateway.LambdaIntegration(lamdaFunction, {
                allowTestInvoke: false
            }),
            anyMethod: true,
        });
        const spaBucket = new s3.Bucket(this, 'spa-bucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        const wafRules = [
            {
                Rule: {
                    name: "AWSManagedRulesBotControlRuleSet",
                    priority: 1,
                    overrideAction: { none: {} },
                    statement: {
                        managedRuleGroupStatement: {
                            vendorName: "AWS",
                            name: "AWSManagedRulesBotControlRuleSet",
                            scopeDownStatement: {
                                byteMatchStatement: {
                                    fieldToMatch: { uriPath: {} },
                                    positionalConstraint: "CONTAINS",
                                    searchString: "api",
                                    textTransformations: [
                                        {
                                            priority: 0,
                                            type: "LOWERCASE"
                                        }
                                    ]
                                }
                            },
                            managedRuleGroupConfigs: [
                                {
                                    awsManagedRulesBotControlRuleSet: { inspectionLevel: "TARGETED" }
                                }
                            ]
                        },
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: "AWSManagedRulesBotControlRuleSet",
                    },
                },
            },
            {
                Rule: {
                    name: "Block-Requests-With-Missing-Or-Rejected-Token-Label",
                    priority: 2,
                    action: { block: {} },
                    statement: {
                        orStatement: {
                            statements: [
                                {
                                    labelMatchStatement: {
                                        scope: 'LABEL',
                                        key: 'awswaf:managed:token:absent'
                                    }
                                },
                                {
                                    labelMatchStatement: {
                                        scope: 'LABEL',
                                        key: 'awswaf:managed:token:rejected'
                                    }
                                }
                            ]
                        }
                    },
                    visibilityConfig: {
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                        metricName: "Block-Requests-With-Missing-Or-Rejected-Token-Label",
                    },
                },
            }
        ];
        const webACL = new waf.CfnWebACL(this, "webACL", {
            name: 'webACL',
            defaultAction: { allow: {} },
            scope: "CLOUDFRONT",
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: "webACL",
                sampledRequestsEnabled: false,
            },
            rules: wafRules.map((wafRule) => wafRule.Rule),
        });
        const cloudfrontDistribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultRootObject: 'index.html',
            comment: 'intelligent waf protection with cross domain SPA',
            defaultBehavior: {
                origin: new origins.S3Origin(spaBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            additionalBehaviors: {
                'api/*': {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                },
            },
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
            webAclId: webACL.attrArn
        });
        const wafSDKCalls = new helperCustomResource(this, 'customResource', {
            Domain: cloudfrontDistribution.distributionDomainName,
        });
        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.data('index.html', html.replace('CAPTCHAURLPLACEHOLDER', wafSDKCalls.captchaIntegrationURL).replace('APIKEYPLACEHOLDER', wafSDKCalls.apiKey))],
            destinationBucket: spaBucket,
        });
        new cdk.CfnOutput(this, 'S3 bucket hosting SPA HTML', { value: spaBucket.bucketName });
        new cdk.CfnOutput(this, 'SPA URL', {
            value: `https://${cloudfrontDistribution.distributionDomainName}`
        });
    }
}


