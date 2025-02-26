const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

require('dotenv').config();

const PORT = process.env.PORT || 8000;
const mongoURI = process.env.MONGODB_URI;
const secretKey = process.env.SECRET_KEY;

const corsOptions = {
    origin: ['http://localhost:3000'],
    credentials: true
  };

const saltRounds = 12;

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

  
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB')
        console.log('Connected to Database', mongoose.connection.name);
    })
    .catch((err) => console.log('Error connecting to MongoDB:', err));

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post('/sign-in', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const User = mongoose.model('User', userSchema);
        const user = await User.findOne({ username });

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log('Invalid password');
            return res.status(401).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ username }, secretKey, { expiresIn: '10s' });
        res.cookie('token', token, {
             httpOnly: true,
             secure: true,
             sameSite: 'none'
        });
        console.log('User signed in successfully');
        res.status(200).json({ message: 'User signed in successfully' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

app.post('/sign-out', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
    });
    console.log('User signed out successfully');
    res.status(200).json({ message: 'User signed out successfully' });
});

app.get('/check-session', (req, res) => {
    const token = req.headers.cookie?.split('=')[1];
    console.log(token);
    console.log(req.headers.cookie);

    if (!token) {
        console.log('No token found');
        return res.json({ auth: false });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        res.json({ auth: true, user: decoded });
        console.log('User is signed in');
    } catch (error) {
        console.error("Error verifying token:", error);
        res.json({ auth: false });
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const User = mongoose.model('User', userSchema);
        const isUserExist = await User.findOne({ username });

        if (isUserExist) {
            console.log('User already exists');
            return res.status(409).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        console.log('User registered successfully,', user);
        res.status(201).json({ message: 'User registered successfully' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
