import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketEventHandlers {
    onJobStatusUpdate?: (data: any) => void;
    onFileStatusUpdate?: (data: any) => void;
    onPreviewUpdated?: (data: any) => void;
}

export const useSocket = (jobId?: string, handlers?: SocketEventHandlers) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const handlersRef = useRef(handlers);

    // Keep handlers ref up to date
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

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

        // Event handlers - use wrapper functions that call the latest handlers from ref
        const handleJobStatusUpdate = (data: any) => {
            console.log('📋 job-status-update event received:', data);
            handlersRef.current?.onJobStatusUpdate?.(data);
        };

        const handleFileStatusUpdate = (data: any) => {
            console.log('📄 file-status-update event received:', data);
            handlersRef.current?.onFileStatusUpdate?.(data);
        };

        const handlePreviewUpdated = (data: any) => {
            console.log('📊 preview-updated event received:', data);
            handlersRef.current?.onPreviewUpdated?.(data);
        };

        // Remove old listeners first to avoid duplicates
        newSocket.off('job-status-update');
        newSocket.off('file-status-update');
        newSocket.off('preview-updated');

        // Register event handlers
        newSocket.on('job-status-update', handleJobStatusUpdate);
        newSocket.on('file-status-update', handleFileStatusUpdate);
        newSocket.on('preview-updated', handlePreviewUpdated);
        
        console.log('📡 Registered all Socket.IO event handlers');

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            if (jobId) {
                newSocket.emit('leave-job', jobId);
                console.log(`📋 Left job room: job-${jobId}`);
            }
            newSocket.off('job-status-update');
            newSocket.off('file-status-update');
            newSocket.off('preview-updated');
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
