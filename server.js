const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const shortid = require('shortid');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define URL Schema
const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true
  },
  shortUrl: {
    type: String,
    required: true,
    unique: true
  },
  urlCode: {
    type: String,
    required: true,
    unique: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Url = mongoose.model('Url', urlSchema);

// Set up Socket.io

// Connect to MongoDB with retry mechanism
const connectWithRetry = () => {
  // mongoose.connect('mongodb://localhost:27017/url-shortner', { [ ...For local host connection ]
  mongoose.connect('mongodb+srv://aadityagunjal0975:pFHVow9cFqjBW7w3@cluster0.psityjt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Create a test URL to verify database is working
    const testUrl = new Url({
      originalUrl: 'https://example.com',
      shortUrl: 'http://localhost:3002/test123',
      urlCode: 'test123',
      clicks: 0
    });
    
    // Check if test URL already exists
    Url.findOne({ urlCode: 'test123' })
      .then(existingUrl => {
        if (!existingUrl) {
          // Save test URL if it doesn't exist
          testUrl.save()
            .then(() => console.log('Test URL created successfully'))
            .catch(err => console.error('Error creating test URL:', err));
        } else {
          console.log('Test URL already exists');
        }
      })
      .catch(err => console.error('Error checking for test URL:', err));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send all URLs to the client upon connection
  const sendAllUrls = () => {
    Url.find().sort({ createdAt: -1 })
      .then(urls => {
        socket.emit('urls', urls);
      })
      .catch(err => {
        console.error('Error fetching URLs:', err);
      });
  };
  
  // Send URLs immediately on connection
  sendAllUrls();
  
  // Listen for explicit request to get all URLs (used on reconnection)
  socket.on('get_urls', () => {
    console.log('Client requested all URLs');
    sendAllUrls();
  });

  // Listen for new URL creation
  socket.on('new_url', (data) => {
    try {
      console.log('Received new_url event with data:', data);
      const { originalUrl } = data;
      console.log('Creating short URL for:', originalUrl);
      
      // Send immediate acknowledgment to client that request is being processed
      socket.emit('processing_url', { originalUrl });
      
      try {
        // Process URL creation synchronously to ensure it's saved
        // Changed from async/await to synchronous to ensure URL is saved before emitting events
        createShortUrl(originalUrl)
          .then(url => {
            if (!url) {
              throw new Error('Failed to create short URL');
            }
            
            console.log('Created short URL:', url);
            
            // Verify the URL was saved to the database
            return Url.findById(url._id)
              .then(savedUrl => {
                if (!savedUrl) {
                  throw new Error('URL was not saved to the database');
                }
                return url;
              });
          })
          .then(url => {
            // Always emit the url_created event to the requesting client
            // This ensures the client gets a response even for existing URLs
            socket.emit('url_created', url);
            
            // Only broadcast to other clients if it's a new URL
            if (!url.isExisting) {
              console.log('Broadcasting url_created event to other clients');
              socket.broadcast.emit('url_created', url);
            } else {
              console.log('URL already exists, not broadcasting to other clients');
            }
          })
          .catch(error => {
            console.error('Error creating short URL:', error);
            socket.emit('error', { message: error.message || 'Failed to create short URL' });
          });
      } catch (error) {
        console.error('Error in createShortUrl call:', error);
        socket.emit('error', { message: error.message || 'Failed to create short URL' });
      }
    } catch (error) {
      console.error('Error in new_url event:', error);
      socket.emit('error', { message: error.message || 'Server error processing URL' });
    }
  });

  // Listen for URL deletion
  socket.on('delete_url', async (data) => {
    try {
      const { id } = data;
      await Url.findByIdAndDelete(id);
      io.emit('url_deleted', { id }); // Broadcast to all clients
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// URL cache to improve performance
const urlCache = new Map();

// Helper function to create a short URL
async function createShortUrl(originalUrl) {
  try {
    // Normalize the URL to prevent duplicates with different protocols
    let normalizedUrl = originalUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
      console.log('Normalized URL by adding https:// prefix:', normalizedUrl);
    }
    
    // Check cache first for better performance
    if (urlCache.has(normalizedUrl)) {
      console.log('URL found in cache');
      return { ...urlCache.get(normalizedUrl), isExisting: true };
    }

    // Check if URL already exists in the database
    console.log('Checking if URL exists in database:', normalizedUrl);
    const existingUrl = await Url.findOne({ originalUrl: normalizedUrl }).lean();
    
    if (existingUrl) {
      console.log('URL found in database:', existingUrl._id);
      // Add to cache for future requests
      urlCache.set(normalizedUrl, existingUrl);
      // Add isExisting flag to indicate this URL already exists
      return { ...existingUrl, isExisting: true };
    }
    
    // Generate a unique short code
    const urlCode = shortid.generate();
    const shortUrl = `http://localhost:3002/${urlCode}`;
    console.log('Generated new short URL:', shortUrl, 'for original URL:', normalizedUrl);
    
    // Create new URL document
    const newUrl = new Url({
      originalUrl: normalizedUrl,
      shortUrl,
      urlCode,
      clicks: 0
    });
    
    // Save to database and wait for it to complete to ensure persistence
    let savedUrl;
    try {
      console.log('Attempting to save URL to database...');
      savedUrl = await newUrl.save();
      console.log('New URL saved to database with ID:', savedUrl._id);
    } catch (saveError) {
      console.error('Error saving URL to database:', saveError);
      // Check if it was a duplicate key error (someone else might have created the same URL)
      if (saveError.code === 11000) {
        console.log('Encountered duplicate key error, checking if URL exists...');
        // Try to find the existing URL again
        const duplicateUrl = await Url.findOne({ originalUrl: normalizedUrl }).lean();
        if (duplicateUrl) {
          console.log('Found duplicate URL after save error:', duplicateUrl._id);
          urlCache.set(normalizedUrl, duplicateUrl);
          return { ...duplicateUrl, isExisting: true };
        }
        
        // Also check if the urlCode already exists (rare but possible collision)
        const duplicateCode = await Url.findOne({ urlCode }).lean();
        if (duplicateCode) {
          console.log('Found duplicate urlCode after save error:', duplicateCode._id);
          // Generate a new code and try again
          console.log('Generating new urlCode and retrying...');
          return createShortUrl(originalUrl); // Recursive call with same URL to get new code
        }
      }
      throw saveError;
    }
    
    // Verify the URL was saved
    console.log('Verifying URL was saved to database...');
    const verifiedUrl = await Url.findById(savedUrl._id);
    if (!verifiedUrl) {
      console.error('URL verification failed - not found in database after save');
      throw new Error('URL was not saved to database');
    }
    
    console.log('URL verified in database with ID:', verifiedUrl._id);
    
    // Convert to plain object and add to cache
    const savedUrlObj = savedUrl.toObject();
    urlCache.set(normalizedUrl, savedUrlObj);
    
    // Add isExisting flag set to false for new URLs
    return { ...savedUrlObj, isExisting: false };
  } catch (error) {
    console.error('Error creating short URL:', error);
    throw error;
  }
}

// API Routes

// Create a short URL
app.post('/api/shorten', async (req, res) => {
  try {
    // Accept either 'url' or 'originalUrl' parameter for compatibility
    const url = req.body.url || req.body.originalUrl;
    
    if (!url) {
      console.error('/api/shorten: URL is required');
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (err) {
      console.error('/api/shorten: Invalid URL:', url);
      return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
      console.log('/api/shorten: Creating short URL for:', url);
      const shortUrl = await createShortUrl(url);
      
      if (!shortUrl) {
        console.error('/api/shorten: Failed to create short URL');
        throw new Error('Failed to create short URL');
      }
      
      console.log('/api/shorten: Short URL created:', shortUrl);
      
      // Remove isExisting flag before sending response
      const { isExisting, ...urlData } = shortUrl;
      
      // Verify the URL was saved to the database
      const savedUrl = await Url.findOne({ _id: shortUrl._id });
      if (!savedUrl) {
        console.error('/api/shorten: URL was not saved to the database:', shortUrl._id);
        throw new Error('URL was not saved to the database');
      }
      
      console.log('/api/shorten: Verified URL was saved to database with ID:', savedUrl._id);
      res.json(urlData);
    } catch (createError) {
      console.error('Error creating short URL:', createError);
      return res.status(500).json({ error: createError.message || 'Failed to create short URL' });
    }
  } catch (error) {
    console.error('Error in /api/shorten:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Get all URLs
app.get('/api/urls', async (req, res) => {
  try {
    const urls = await Url.find().sort({ createdAt: -1 });
    res.json(urls);
  } catch (error) {
    console.error('Error in /api/urls:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a URL
app.delete('/api/urls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Url.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/urls/:id:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cache for URL codes to improve redirect performance
const redirectCache = new Map();

// Redirect to original URL
app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Check cache first for better performance
    let url;
    if (redirectCache.has(code)) {
      url = redirectCache.get(code);
      console.log('Redirect URL found in cache');
    } else {
      url = await Url.findOne({ urlCode: code });
      if (url) {
        // Add to cache for future requests
        redirectCache.set(code, url);
      }
    }
    
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Increment click count
    url.clicks += 1;
    
    // Update cache with new click count
    if (redirectCache.has(code)) {
      redirectCache.set(code, url);
    }
    
    // Save to database - we'll use a promise but start the redirect immediately
    const savePromise = url.save();
    
    // Redirect to original URL immediately
    res.redirect(url.originalUrl);
    
    // After redirect is sent, wait for save to complete and emit event
    try {
      await savePromise;
      // Emit click event to all connected clients after save
      io.emit('url_clicked', { id: url._id, clicks: url.clicks });
    } catch (err) {
      console.error('Error saving click count:', err);
    }
    
    return;
  } catch (error) {
    console.error('Error in /:code redirect:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});