// src/server.js
const express = require('express'); 
const app = require('./app');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const Message = require('./models/message'); // Import your Message model

// Global variable to handle cache invalidation
global.invalidateCache = false;

const server = http.createServer(app);
const io = socketIO(server);

io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
        console.log(`User joined room ${roomId}`);
    });
    
    socket.on('leaveRoom', ({ roomId }) => {
        socket.leave(roomId);
        console.log(`User left room ${roomId}`);
    });

    socket.on('sendMessage', async ({ roomId, content, sender }) => {
        console.log('Received message data:', { roomId, content, sender });
    
        const message = new Message({ roomId, content, sender });
        try {
            await message.save();
            const populatedMessage = await Message.findById(message._id).populate('sender', 'username').exec();
            io.to(roomId).emit('message', {
                _id: populatedMessage._id, // Ensure the message ID is included
                sender: populatedMessage.sender,
                content: populatedMessage.content,
                roomId: populatedMessage.roomId,
                timestamp: populatedMessage.timestamp
            });

            // Set the invalidateCache flag to true when a new message is sent
            global.invalidateCache = true;
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

const PORT = process.env.PORT || 3000;

// Start server only after ensuring database connection
mongoose.connection.once('open', () => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

// Add the SIGINT handler for graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection disconnected through app termination');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
