require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const cors = require('cors');
const pdf = require('pdf-parse');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('public'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Error: Images/PDF only!'));
    }
  }
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.2,
    topP: 1,
    topK: 32,
    maxOutputTokens: 2048,
  }
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
const dbName = 'invoice_analyzer';
let db;

(async () => {
  try {
    const client = await MongoClient.connect(mongoURI);
    console.log('Connected to MongoDB');
    db = client.db(dbName);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
})();

// Process PDF files
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (err) {
    console.error('PDF extraction error:', err);
    throw new Error('Failed to extract PDF text');
  }
}

// Extract invoice data
async function extractInvoiceData(filePath, originalname) {
  try {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : `image/${ext.substring(1)}`;

    const prompt = `Extract ALL data from this ${ext === '.pdf' ? 'PDF invoice' : 'invoice image'} as JSON with:
    - vendor details (name, address, contact)
    - invoice number, date, due date
    - ALL line items (description, quantity, unit price, amount)
    - subtotal, taxes, discounts, total
    - payment terms, notes
    Return ONLY valid JSON.`;

    let input;
    if (ext === '.pdf') {
      const text = await extractTextFromPDF(fileData);
      input = { text: prompt + "\n\n" + text };
    } else {
      input = {
        inlineData: {
          data: fileData.toString('base64'),
          mimeType
        }
      };
    }

    const result = await model.generateContent([prompt, input]);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const jsonString = text.slice(jsonStart, jsonEnd);

    const invoiceData = JSON.parse(jsonString);
    return {
      ...invoiceData,
      originalFilename: originalname,
      filePath,
      uploadDate: new Date()
    };
  } catch (error) {
    console.error('Invoice extraction error:', error);
    throw new Error(`Failed to process invoice: ${error.message}`);
  }
}

// Routes
app.post('/api/invoices/upload', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    
    const invoiceData = await extractInvoiceData(req.file.path, req.file.originalname);
    const result = await db.collection('invoices').insertOne(invoiceData);

    res.json({
      success: true,
      invoiceId: result.insertedId,
      data: invoiceData
    });

    // Cleanup file after processing
    fs.unlink(req.file.path, (err) => err && console.error('File cleanup error:', err));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await db.collection('invoices')
      .find({})
      .sort({ uploadDate: -1 })
      .toArray();
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(req.params.id)
    });
    invoice ? res.json({ success: true, data: invoice }) 
            : res.status(404).json({ success: false, message: 'Invoice not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const result = await db.collection('invoices').deleteOne({
      _id: new ObjectId(req.params.id)
    });
    result.deletedCount ? res.json({ success: true }) 
                       : res.status(404).json({ success: false, message: 'Invoice not found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fix: Changed from app.get to app.get with correct query parameter
app.get('/api/invoices/search', async (req, res) => {
  try {
    // Fix: Changed from req.query.q to req.query.query to match frontend
    const query = req.query.query;
    if (!query) {
      // If no query parameter, return all invoices
      return res.redirect('/api/invoices');
    }

    const invoices = await db.collection('invoices').find({
      $or: [
        { vendorName: { $regex: query, $options: 'i' } },
        { invoiceNumber: { $regex: query, $options: 'i' } },
        // Fix: Added proper handling for line items that might not exist
        { 'items.description': { $regex: query, $options: 'i' } }
      ]
    }).toArray();

    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});