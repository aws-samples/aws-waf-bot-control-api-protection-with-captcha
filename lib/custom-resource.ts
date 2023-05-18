import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface helperCustomResourceProps {
  Domain: string
}

export class helperCustomResource extends Construct {
  public readonly apiKey: string;
  public readonly captchaIntegrationURL: string;


  constructor(scope: Construct, id: string, props: helperCustomResourceProps) {
    super(scope, id);

    const lambdaPolicy = new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            resources: [
              "*",
            ],
            actions: ["wafv2:ListAPIKeys", "wafv2:CreateAPIKey"], 
          }),
        ],
      });

    const { managedPolicyArn } = iam.ManagedPolicy.fromAwsManagedPolicyName(
      "service-role/AWSLambdaBasicExecutionRole"
    );

    const lambdaRole = new iam.Role(this, "crLambdaRole", {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com")
      ),
      managedPolicies: [
        {
          managedPolicyArn,
        },
      ],
      inlinePolicies: {
        myPolicy: lambdaPolicy,
      },
    });
// todo update runtime
    const onEvent = new lambda.SingletonFunction(this, 'crSingleton', {
      uuid: 'f7d4d730-dhd1-22hge8-9c2d-fnbebdjdh',     
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(60),
      code: lambda.Code.fromAsset("lambda/custom-resource"),
      role: lambdaRole,
    });

    const myProvider = new cr.Provider(this, 'crProvider', {
      onEventHandler: onEvent,
      logRetention: logs.RetentionDays.ONE_DAY  
    });

    const resource = new cdk.CustomResource(this, 'crResource', { serviceToken: myProvider.serviceToken, properties: props });

    this.apiKey = resource.getAtt('APIKey').toString();
    this.captchaIntegrationURL = resource.getAtt('CaptchaIntegrationURL').toString();

  }
}
