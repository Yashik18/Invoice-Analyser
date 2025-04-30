Invoice Analyzer
A web application for automatically extracting data from invoice PDFs and images using AI.

Features
Upload PDF and image files (JPG, PNG) of invoices
AI-powered extraction of invoice data (vendor details, line items, totals, etc.)
View detailed information for each invoice
Search functionality for finding specific invoices
Delete unwanted invoices
Responsive design
Tech Stack
Frontend: HTML, CSS, JavaScript with Bootstrap 5
Backend: Node.js with Express
Database: MongoDB
AI: Google's Gemini 1.5 Flash API for invoice data extraction
File Processing: Multer for file uploads, pdf-parse for PDF text extraction
Setup Instructions
Prerequisites
Node.js (v14 or higher)
MongoDB
Google Gemini API key
Installation
Clone the repository:
git clone https://github.com/yourusername/invoice-analyzer.git
cd invoice-analyzer
Install dependencies:
npm install
Create a .env file in the root directory with the following variables:
PORT=3000
MONGODB_URI=mongodb://localhost:27017
GEMINI_API_KEY=your_gemini_api_key
Create an uploads directory in the root folder:
mkdir uploads
Running the Application
Start the server:
node server.js
Open your browser and navigate to http://localhost:3000
Project Structure
server.js - Express server and API endpoints
public/ - Static files (HTML, CSS, client-side JavaScript)
index.html - Main application page
app.js - Frontend JavaScript
API Endpoints
POST /api/invoices/upload - Upload and analyze an invoice
GET /api/invoices - Get all invoices
GET /api/invoices/:id - Get a specific invoice by ID
DELETE /api/invoices/:id - Delete an invoice
GET /api/invoices/search?query=text - Search for invoices
Fixes Applied
Fixed route conflict with /api/invoices/:id and /api/invoices/search by updating the search endpoint implementation
Synchronized the query parameter name between frontend and backend (using query instead of q)
Added proper error handling for the DELETE endpoint
Improved the multer file filter error handling
Added HTML sanitization in the frontend to prevent XSS attacks
Implemented comprehensive error handling for date and currency parsing
Fixed the invoice search implementation
Notes
For production deployment, consider adding authentication and user accounts
The application currently stores extracted invoice data but not the original files after processing
Add throttling/rate limiting for production use to manage API costs
