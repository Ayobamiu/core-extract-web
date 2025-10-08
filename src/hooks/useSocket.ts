import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketEventHandlers {
    onJobStatusUpdate?: (data: any) => void;
    onFileStatusUpdate?: (data: any) => void;
}

export const useSocket = (jobId?: string, handlers?: SocketEventHandlers) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Create socket connection
        const newSocket = io('http://localhost:3000', {
            transports: ['websocket', 'polling'],
        });

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('🔌 Connected to server:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            setIsConnected(false);
        });

        // Join job room if jobId is provided
        if (jobId) {
            newSocket.emit('join-job', jobId);
            console.log(`📋 Joined job room: job-${jobId}`);
        }

        // Event handlers
        if (handlers?.onJobStatusUpdate) {
            newSocket.on('job-status-update', handlers.onJobStatusUpdate);
        }

        if (handlers?.onFileStatusUpdate) {
            newSocket.on('file-status-update', handlers.onFileStatusUpdate);
        }

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            if (jobId) {
                newSocket.emit('leave-job', jobId);
                console.log(`📋 Left job room: job-${jobId}`);
            }
            newSocket.disconnect();
        };
    }, [jobId]);

    // Leave job room when jobId changes
    useEffect(() => {
        if (socket && jobId) {
            socket.emit('join-job', jobId);
            console.log(`📋 Joined job room: job-${jobId}`);
        }
    }, [socket, jobId]);

    return { socket, isConnected };
};
