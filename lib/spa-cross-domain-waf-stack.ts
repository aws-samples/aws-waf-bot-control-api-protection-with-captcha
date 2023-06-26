
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
import fs = require('fs');

const wafDefaultRules = [
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
                    ],
                    ruleActionOverrides: [
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'TGT_VolumetricIpTokenAbsent'
                        },
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'SignalNonBrowserUserAgent'
                        },
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'CategoryHttpLibrary'
                        }         
                    ]
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWSManagedRulesBotControlRuleSet",
            },
        }
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

const wafCORSRules = [
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
                        andStatement: {
                            statements: [
                                {
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
                                {
                                    notStatement: {
                                        statement: {
                                            byteMatchStatement: {
                                                fieldToMatch: {
                                                    method : {},
                                                },
                                                positionalConstraint: 'EXACTLY',
                                                searchString: 'OPTIONS',
                                                textTransformations: [{
                                                    type: 'NONE',
                                                    priority: 0
                                                }]
                                            }
                                        }
                                    }
        
                                }
                            ]
                        }
                    },
                    managedRuleGroupConfigs: [
                        {
                            awsManagedRulesBotControlRuleSet: { inspectionLevel: "TARGETED" }
                        }
                    ],
                    ruleActionOverrides: [
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'TGT_VolumetricIpTokenAbsent'
                        },
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'SignalNonBrowserUserAgent'
                        },
                        {
                            actionToUse : {
                                captcha: {}
                            },
                            name : 'CategoryHttpLibrary'
                        }    
                    ]
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWSManagedRulesBotControlRuleSet",
            },
        }
    },
    {
        Rule: {
            name: "Block-Requests-With-Missing-Or-Rejected-Token-Label",
            priority: 2,
            action: { block: {} },
            statement: {
                andStatement: {
                    statements: [
                        {
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
                        {
                            notStatement: {
                                statement: {
                                    byteMatchStatement: {
                                        fieldToMatch: {
                                            method : {},
                                        },
                                        positionalConstraint: 'EXACTLY',
                                        searchString: 'OPTIONS',
                                        textTransformations: [{
                                            type: 'NONE',
                                            priority: 0
                                        }]
                                    }
                                }
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

export class SpaCrossDomainWafStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

        const CROSS_DOMAIN_ENABLED = this.node.tryGetContext('CROSS_DOMAIN_ENABLED') || 'false';
        var html;
        var api;
        var cloudfrontDistributionAPI;
        var cloudfrontDistributionHTML;
        var webACL;


        const path = require('node:path');
        const apiFunction = new lambda.Function(this, 'lamdaFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/origin')),
            architecture: lambda.Architecture.X86_64,
        });
        const spaBucket = new s3.Bucket(this, 'spa-bucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        
        html = fs.readFileSync('html/spa.html', 'utf8');

        if (CROSS_DOMAIN_ENABLED === 'false') {
            html = html.replace('APIURLPLACDHOLDER', 'api/');
            api = new apiGateway.RestApi(this, "api", {
                endpointConfiguration: {
                    types: [apiGateway.EndpointType.REGIONAL]
                }
            });
            webACL = new waf.CfnWebACL(this, "webACL", {
                name: 'webACL',
                defaultAction: { allow: {} },
                scope: "CLOUDFRONT",
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: "webACL",
                    sampledRequestsEnabled: false,
                },
                rules: wafDefaultRules.map((wafRule) => wafRule.Rule),
            });
            cloudfrontDistributionHTML = new cloudfront.Distribution(this, 'Distribution', {
                defaultRootObject: 'index.html',
                comment: 'intelligent waf protection with cross domain SPA',
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
                defaultBehavior: {
                    origin: new origins.S3Origin(spaBucket),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED 
                },
                additionalBehaviors: {
                    'api/*': {
                        origin: new origins.RestApiOrigin(api),
                        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                    }
                },
                webAclId: webACL.attrArn
            });


        } else {
            cloudfrontDistributionHTML = new cloudfront.Distribution(this, 'Distribution', {
                defaultRootObject: 'index.html',
                comment: 'intelligent waf protection with cross domain SPA',
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
                defaultBehavior: {
                    origin: new origins.S3Origin(spaBucket),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
                },

            });

            api = new apiGateway.RestApi(this, "api", {
                endpointConfiguration: {
                    types: [apiGateway.EndpointType.REGIONAL]
                },
                defaultCorsPreflightOptions: {
                    allowHeaders: [
                      'X-Aws-Waf-Token'
                    ],
                    allowMethods: ['OPTIONS', 'GET'],
                    allowOrigins: [`https://${cloudfrontDistributionHTML.distributionDomainName}`]
                  }
            });
            
            webACL = new waf.CfnWebACL(this, "webACL", {
                name: 'webACL',
                defaultAction: { allow: {} },
                scope: "CLOUDFRONT",
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: "webACL",
                    sampledRequestsEnabled: false,
                },
                rules: wafCORSRules.map((wafRule) => wafRule.Rule),
                tokenDomains: [cloudfrontDistributionHTML.domainName]
            });

            const responseHeaderPolicy = new cloudfront.ResponseHeadersPolicy(this, `ResponseHeadersPolicy${this.node.addr}`, {
                responseHeadersPolicyName: 'CORSResponsePolicy',
                corsBehavior: {
                  accessControlAllowCredentials: false,
                  accessControlAllowHeaders: ['X-Aws-Waf-Token'],
                  accessControlAllowMethods: ['GET','OPTIONS'],
                  accessControlAllowOrigins: [`https://${cloudfrontDistributionHTML.distributionDomainName}`],
                  accessControlMaxAge: cdk.Duration.seconds(600),
                  originOverride: true,
                }
              });  

            cloudfrontDistributionAPI = new cloudfront.Distribution(this, 'DistributionAPI', {
                comment: 'intelligent waf protection with cross domain SPA - API',
                minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
                defaultBehavior: {
                    origin: new origins.RestApiOrigin(api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS ,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                    responseHeadersPolicy: responseHeaderPolicy
                },
                webAclId: webACL.attrArn
            });
            html = html.replace('APIURLPLACDHOLDER', `https://${cloudfrontDistributionAPI.distributionDomainName}/api/`);
            new cdk.CfnOutput(this, 'API URL', {
                value: `https://${cloudfrontDistributionAPI.distributionDomainName}/api/`
            });
        } 

        const myip = api.root.addResource('api');
        myip.addMethod(
            'GET',
            new apiGateway.LambdaIntegration(apiFunction, {proxy: true}),
        );

        const wafSDKCalls = new helperCustomResource(this, 'customResource', {
            Domain: cloudfrontDistributionHTML.distributionDomainName,
            ID: 'f7d4d730-dhd1-22hge8-9c2d-fnbebdjdh'
        });

        html = html.replace('CAPTCHAURLPLACEHOLDER', wafSDKCalls.captchaIntegrationURL)
        html = html.replace('APIKEYPLACEHOLDER', wafSDKCalls.apiKey);

        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.data('index.html', html)],
            destinationBucket: spaBucket,
            cacheControl: [s3deploy.CacheControl.fromString('max-age=5')],
        });
        new cdk.CfnOutput(this, 'S3 bucket hosting SPA HTML', { value: spaBucket.bucketName });
        new cdk.CfnOutput(this, 'SPA URL', {
            value: `https://${cloudfrontDistributionHTML.distributionDomainName}`
        });
    }
}


