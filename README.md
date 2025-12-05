# Kent Woodyards Magical Shipping Unicorn 🦄

A React application that compares current shipping rates with Loop's negotiated USPS and FedEx rates. Upload CSV files containing shipping data, calculate zones, and see potential savings with Loop's negotiated rates.

![Loop Shipping Calculator](https://img.shields.io/badge/React-18.2.0-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue?logo=typescript)

## Features

- **CSV File Upload**: Drag and drop or select CSV files with shipping data
- **Zone Calculation**: Automatic zone calculation for USPS and FedEx shipments
- **Rate Comparison**: Compare current rates with Loop's negotiated rates
- **Real-time Processing**: See calculations update as they're processed
- **Savings Analysis**: View total and average savings with summary statistics
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Optional: USPS and FedEx API credentials for live zone calculation

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd shipping-calculator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (Optional)
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your API credentials:
   ```env
   REACT_APP_USPS_API_KEY=your_usps_api_key
   REACT_APP_FEDEX_API_KEY=your_fedex_api_key
   REACT_APP_FEDEX_SECRET=your_fedex_secret
   REACT_APP_FEDEX_ACCOUNT_NUMBER=your_fedex_account
   ```

   **Note**: Without API keys, the application uses approximate zone calculations based on ZIP code proximity.

4. **Start the development server**
   ```bash
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

## CSV File Format

The application expects CSV files with the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| `ORIGIN_ZIP` | Origin ZIP code | ✅ |
| `DESTINATION_ZIP` | Destination ZIP code | ✅ |
| `PKG_WEIGHT_IN_GRAMS` | Package weight in grams | ✅ |
| `CARRIER` | Shipping carrier (USPS/FedEx) | ✅ |
| `TOTAL_LABEL_RATE_SHOPPER_CURRENCY` | Current shipping rate | ✅ |
| `TRACKING_NUMBER` | Tracking number | ❌ |
| `LABEL_SERVICE` | Service type | ❌ |
| `ORIGIN_CITY`, `ORIGIN_STATE` | Origin location | ❌ |
| `DESTINATION_CITY`, `DESTINATION_STATE` | Destination location | ❌ |

## Project Structure

```
src/
├── components/           # React components
│   ├── CSVUpload.tsx    # File upload component
│   └── ShippingTable.tsx # Data display table
├── services/            # Business logic
│   ├── apiService.ts    # API integration (USPS/FedEx)
│   └── rateComparisonService.ts # Rate comparison logic
├── types/               # TypeScript interfaces
│   └── index.ts         # Type definitions
├── App.tsx              # Main application component
└── index.tsx            # Application entry point
```

## API Integration

### USPS API
- **Endpoint**: `https://api.usps.com/domestic-prices/v3`
- **Purpose**: Zone calculation and rate lookup
- **Fallback**: ZIP code proximity-based zone estimation

### FedEx API
- **Endpoint**: `https://apis.fedex.com`
- **Purpose**: Zone calculation and rate quotes
- **Fallback**: ZIP code proximity-based zone estimation

## Deployment on AWS Amplify

### Method 1: GitHub Integration (Recommended)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/shipping-calculator.git
   git push -u origin main
   ```

2. **Create Amplify App**
   - Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
   - Click "New app" → "Host web app"
   - Choose "GitHub" as source
   - Connect your GitHub account and select the repository
   - Choose the `main` branch

3. **Configure Build Settings**
   Amplify will auto-detect React. Verify the build configuration:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: build
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

4. **Add Environment Variables** (Optional)
   - In Amplify Console, go to "App settings" → "Environment variables"
   - Add your API keys:
     - `REACT_APP_USPS_API_KEY`
     - `REACT_APP_FEDEX_API_KEY`
     - `REACT_APP_FEDEX_SECRET`
     - `REACT_APP_FEDEX_ACCOUNT_NUMBER`

5. **Deploy**
   - Review settings and click "Save and deploy"
   - Amplify will build and deploy automatically
   - Access your app at the provided URL

### Method 2: Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy via Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   amplify init
   amplify add hosting
   amplify publish
   ```

### Method 3: Zip Upload

1. **Build and create deployment package**
   ```bash
   npm run build
   cd build
   zip -r ../shipping-calculator.zip .
   ```

2. **Upload via Amplify Console**
   - Choose "Deploy without Git provider"
   - Upload the zip file
   - Configure environment variables if needed

## Environment Configuration

### Development
```bash
npm start          # Start development server
npm test           # Run tests
npm run build      # Build for production
```

### Production Environment Variables
Set these in your deployment platform:
- `REACT_APP_USPS_API_KEY` - USPS API key
- `REACT_APP_FEDEX_API_KEY` - FedEx API key
- `REACT_APP_FEDEX_SECRET` - FedEx API secret
- `REACT_APP_FEDEX_ACCOUNT_NUMBER` - FedEx account number

## Troubleshooting

### Common Issues

1. **CSV Upload Issues**
   - Ensure CSV has required columns
   - Check for encoding issues (use UTF-8)
   - Verify data formatting

2. **Zone Calculation Issues**
   - Check API credentials
   - Verify ZIP code format (5-digit)
   - Review network connectivity

3. **Rate Comparison Issues**
   - Ensure negotiated rate files are in `/public/Data/`
   - Check file paths and CSV formatting
   - Verify weight conversions (grams to pounds)

### API Rate Limits
- USPS: 1000 requests per hour
- FedEx: Varies by account type
- Use approximate calculations as fallback

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Open an issue on GitHub
- Contact the development team
- Review the documentation

---

Built with ❤️ for Loop shipping optimization
