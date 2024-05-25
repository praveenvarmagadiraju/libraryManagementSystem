const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');  

// mongodb database configaration
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;   
const MONGODB_URI = 'mongodb+srv://praveen:praveen@cluster0.hv0ctd1.mongodb.net/';
const JWT_SECRET = 'your_secret_key';

// created the middlewares for the Authutiction puroses
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send('Invalid token');
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user)
    { 
        return res.status(401).send('Access denied');
    }  
  next();
};

const requireRole = (role) => (req, res, next) => {
   // console.log(req.user);
    console.log(role)
    console.log(req.user.role);
  if (!req.user || req.user.role !== role){

     return res.status(403).send('Forbidden');
  }
  next();
};

app.use(authMiddleware);

// Connecting to the database mongoose
mongoose.connect(MONGODB_URI).then(()=>{
    console.log("Mongodb Connection succuss");
});

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Member'], default: 'Member' },
  borrowHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Borrow' }],
});

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  ISBN: { type: String, required: true, unique: true },
  publicationDate: { type: Date, required: true },
  genre: { type: String, required: true },
  numberOfCopies: { type: Number, required: true },
});

const borrowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  borrowDate: { type: Date, default: Date.now },
  returnDate: { type: Date },
});
//Models for schemas
const User = mongoose.model('User', userSchema);
const Book = mongoose.model('Book', bookSchema);
const Borrow = mongoose.model('Borrow', borrowSchema);

// Apis to register a user
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const user = new User({ name, email, password });
    await user.save();
    res.status(201).send('User registered');
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  }
});

//Api to user login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email:email , password:password });
    if (!user){
         return res.status(400).send('Invalid credentials');
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.send({ token });
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//Api to get all the users
app.get('/api/users', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

// Api to add the Book in to db
app.post('/api/books', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const { title, author, ISBN, publicationDate, genre, numberOfCopies } = req.body;
    const book = new Book({ title, author, ISBN, publicationDate, genre, numberOfCopies });
    await book.save();
    res.status(201).send('Book added');
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//Api to update the book
app.put('/api/books/:id', requireAuth, requireRole('Admin'), async (req, res) => {
    console.log('put api');
  try {
    const { id } = req.params;
    console.log(req.params);
    const updateFields = req.body;
    console.log(updateFields);
    const book = await Book.findByIdAndUpdate(id, updateFields, { new: true });
    if (!book) return res.status(404).send('Book not found');
    res.send(book);
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal server error');
  } 
});

//Api to delete the book by id
app.delete('/api/books/:id', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await Book.findByIdAndDelete(id);
    res.send('Book deleted');
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//Api to get all the books
app.get('/api/books', async (req, res) => {
  try {
    const { genre, author, page = 1, limit = 10 } = req.query;
    const query = {};
    if (genre) query.genre = genre;
    if (author) query.author = author;

    const books = await Book.find(query).limit(limit * 1).skip((page - 1) * limit);
    const count = await Book.countDocuments(query);

    res.json({
      books,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

// Api for borrowing a book 
app.post('/api/borrows/borrow', requireAuth, requireRole('Member'), async (req, res) => {
  try {
  //  const { bookId } = req.body;
    const bookId = req.body._id;
    const book = await Book.findById(bookId);
    if (!book || book.numberOfCopies < 1) return res.status(400).send('Book not available');

    const borrow = new Borrow({ userId: req.user.userId, bookId, borrowDate: new Date() });
    await borrow.save();
    book.numberOfCopies -= 1;
    await book.save();
    res.status(201).send('Book borrowed');
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//api for return back of book
app.post('/api/borrows/return', requireAuth, requireRole('Member'), async (req, res) => {
  try {
   // const { borrowId } = req.body;
   const borrowId = req.body._id;
    const borrow = await Borrow.findById(borrowId);
    if (!borrow || borrow.userId.toString() !== req.user.userId) return res.status(400).send('Not authorized');

    borrow.returnDate = new Date();
    await borrow.save();
    const book = await Book.findById(borrow.bookId);
    book.numberOfCopies += 1;
    await book.save();
    res.send('Book returned');
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//api for borrow history
app.get('/api/borrows/history', requireAuth, requireRole('Member'), async (req, res) => {
  try {
    const history = await Borrow.find({ userId: req.user.userId }).populate('bookId');
    res.json(history);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

// Api for mostborrowed books
app.get('/api/reports/most-borrowed', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const mostBorrowed = await Borrow.aggregate([
      { $group: { _id: '$bookId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $project: { count: 1, 'book.title': 1, 'book.author': 1 } },
    ]);
    res.json(mostBorrowed);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//apis for active members
app.get('/api/reports/active-members', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const activeMembers = await Borrow.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { count: 1, 'user.name': 1, 'user.email': 1 } },
    ]);
    res.json(activeMembers);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

//Api for books availability
app.get('/api/reports/book-availability', requireAuth, requireRole('Admin'), async (req, res) => {
  try {
    const bookAvailability = await Book.aggregate([
      { $lookup: { from: 'borrows', localField: '_id', foreignField: 'bookId', as: 'borrowRecords' } },
      { $project: {
        title: 1,
        totalCopies: '$numberOfCopies',
        borrowedCopies: { $size: '$borrowRecords' },
        availableCopies: { $subtract: ['$numberOfCopies', { $size: '$borrowRecords' }] },
      } },
    ]);
    res.json(bookAvailability);
  } catch (error) {
    res.status(500).send('Internal server error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
