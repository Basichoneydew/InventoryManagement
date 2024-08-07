'use client'
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera } from 'react-camera-pro';
import { Box, Button, Typography } from '@mui/material';
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { app, firebaseConfig } from '../../firebase';
import PropTypes from 'prop-types';

const db = getFirestore(app);

const CameraComponent = ({ onCapture, onClose }) => {
    const camera = useRef(null);
    const [numberOfCameras, setNumberOfCameras] = useState(0);
    const [cameraError, setCameraError] = useState(false);
    const [facingMode, setFacingMode] = useState('environment');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => setCameraError(false))
                .catch(() => setCameraError(true));
        }
    }, []);

    const handleCapture = useCallback(async () => {
        setLoading(true);
        const photo = camera.current.takePhoto();
        try {
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: photo }),
            });

            if (!response.ok) {
                throw new Error(`Failed to process image: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            const detectedItem = result.labelAnnotations && result.labelAnnotations.length > 0
                ? result.labelAnnotations[0].description
                : result.item;

            if (detectedItem) {
                const itemRef = collection(db, 'stock');
                const querySnapshot = await getDocs(query(itemRef, where("name", "==", detectedItem)));

                if (querySnapshot.empty) {
                    try {
                        await setDoc(doc(db, 'stock', detectedItem), {
                            name: detectedItem,
                            quantity: 1,
                        });
                    } catch (error) {
                        console.error('Error adding item to Firebase:', error);
                    }
                } else {
                    const existingItem = querySnapshot.docs[0];
                    const currentQuantity = existingItem.data().quantity;
                    const newQuantity = currentQuantity + 1;

                    try {
                        await updateDoc(doc(db, 'stock', detectedItem), {
                            quantity: newQuantity,
                        });
                    } catch (error) {
                        console.error('Error updating item quantity in Firebase:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing image:', error);
        } finally {
            setLoading(false);
            window.location.reload();
        }
    }, [onClose]);

    const handleSwitchCamera = useCallback(() => {
        setFacingMode(prevMode => prevMode === 'environment' ? 'user' : 'environment');
    }, []);

    const buttonStyle = {
        bgcolor: "#523107",
        '&:hover': { bgcolor: "#3e2505" },
        fontSize: '1.2rem',
        padding: '12px 24px',
    };

    return (
        <Box position="fixed" top="0" left="0" width="100%" height="100%" bgcolor="black" zIndex="1000">
            {cameraError ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
                    <Typography variant="h5" color="error" gutterBottom>
                        Camera not available
                    </Typography>
                    <Typography variant="body1" color="white">
                        Please check your camera permissions and try again.
                    </Typography>
                    <Button variant="contained" onClick={onClose} sx={{ ...buttonStyle, marginTop: '20px' }}>
                        Close
                    </Button>
                </Box>
            ) : (
                <>
                    <Camera ref={camera} numberOfCamerasCallback={setNumberOfCameras} facingMode={facingMode} aspectRatio={16 / 9} />
                    <Box position="absolute" bottom="90px" left="0" width="100%" display="flex" justifyContent="center" gap={20}>
                        <Button variant="contained" onClick={handleCapture} sx={buttonStyle} disabled={loading}>
                            {loading ? "Loading..." : "Capture and Recognize"}
                        </Button>
                        {numberOfCameras > 1 && (
                            <Button variant="contained" onClick={handleSwitchCamera} sx={buttonStyle}>
                                Switch Camera
                            </Button>
                        )}
                    </Box>
                    <Button
                        variant="contained"
                        onClick={onClose}
                        sx={{ ...buttonStyle, position: 'absolute', top: '40px', right: '40px' }}
                    >
                        Close Camera
                    </Button>
                </>
            )}
        </Box>
    );
};

CameraComponent.propTypes = {
    onCapture: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default CameraComponent;