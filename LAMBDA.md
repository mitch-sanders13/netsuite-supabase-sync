# AWS Lambda Deployment for NetSuite-Supabase Sync

This guide provides instructions for deploying the NetSuite-Supabase Sync application to AWS Lambda.

## Prerequisites

- AWS Account with appropriate permissions to create Lambda functions
- AWS CLI installed and configured (optional, for command-line deployment)
- Node.js 20.x or later

## Preparation

The application has been adapted to work as an AWS Lambda function. The key files are:

- `index.js` - Lambda entry point that exports the handler
- `src/lambda.js` - Contains the Lambda handler implementation
- Other application files remain unchanged

## Building the Deployment Package

1. Use the provided build script to create a deployment package:

```bash
npm run build:lambda
```

This script will:
- Create a `lambda-package` directory
- Copy the necessary files (src, package.json, index.js, .env files)
- Install production dependencies
- Create a `function.zip` file ready for deployment

## Environment Variables

The Lambda function requires the same environment variables as the regular application. You can set these in the AWS Lambda console or using Infrastructure as Code tools.

Required environment variables:
- `NS_ACCOUNT_ID`
- `NS_CONSUMER_KEY`
- `NS_CONSUMER_SECRET`
- `NS_TOKEN_ID`
- `NS_TOKEN_SECRET`
- `NS_SCRIPT_ID`
- `NS_DEPLOY_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## Deployment

### AWS Console Deployment

1. Go to AWS Lambda console
2. Create new function
   - Select "Author from scratch"
   - Set function name (e.g., "netsuite-supabase-sync")
   - Select Node.js 20.x runtime
   - Choose or create an execution role with appropriate permissions
3. Upload the `function.zip` deployment package
4. Configure environment variables
5. Configure memory and timeout:
   - Memory: At least 512 MB recommended
   - Timeout: At least 5 minutes (300 seconds) recommended, depending on data volume

### AWS CLI Deployment

```bash
aws lambda create-function \
  --function-name netsuite-supabase-sync \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::<account-id>:role/<role-name> \
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={NS_ACCOUNT_ID=xxx,NS_CONSUMER_KEY=xxx,...}"
```

## Scheduling

To run the sync function on a schedule:

1. Go to Amazon EventBridge (CloudWatch Events)
2. Create a new rule:
   - Use schedule expression (e.g., `rate(6 hours)` or `cron(0 */6 * * ? *)`)
   - Select the Lambda function as the target
3. Enable the rule

## Testing

You can test the function from the AWS Lambda console:
- Create a test event with an empty JSON object (`{}`)
- Click "Test" to run the function

## Monitoring

Monitor your Lambda function using:
- CloudWatch Logs
- CloudWatch Metrics
- Lambda function dashboard

## Troubleshooting

Common issues:
- Timeout: Increase the Lambda timeout setting
- Memory errors: Increase the allocated memory
- Permission errors: Check the execution role permissions
- Missing environment variables: Verify all required variables are set

If you encounter any issues, check the CloudWatch Logs for detailed error messages. 