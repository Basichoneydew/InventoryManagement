'use client'
import Image from 'next/image';
import { useState, useEffect, useMemo, } from 'react';
import { firestore, storage, auth } from '../firebase'
import { Box, Modal, Typography, Stack, TextField, Button, Link } from '@mui/material'
import { collection, deleteDoc, doc, getDocs, query, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import CameraComponent from './components/CameraComponent';

export default function Home() {
  const [inventory, setInventory] = useState([])
  const [open, setOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [searchTerm, setSearchTerm] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const updateInventory = async () => {
    try {
      const snapshot = query(collection(firestore, 'stock'));
      const docs = await getDocs(snapshot);
      const inventoryList = [];
      docs.forEach((doc) => {
        inventoryList.push({
          name: doc.id,
          ...doc.data(),
        });
      });
      setInventory(inventoryList);
    } catch (error) {
      console.error("Error updating inventory:", error);
    }
  }

  const removeItem = async (item, quantity = 1) => {
    const docRef = doc(collection(firestore, 'stock'), item)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const currentQuantity = docSnap.data().quantity
      const newQuantity = Math.max(0, currentQuantity - quantity)
      if (newQuantity === 0) {
        await deleteDoc(docRef)
      } else {
        await setDoc(docRef, { quantity: newQuantity })
      }
    }

    await updateInventory()
  }

  const addItem = async (item, quantity = 1) => {
    console.log('Adding item:', item);
    console.log('Type of item:', typeof item);

    if (typeof item !== 'string') {
      console.error('Item must be a string. Received:', item);
      return;
    }

    const docRef = doc(collection(firestore, 'stock'), item);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const currentQuantity = docSnap.data().quantity;
      await setDoc(docRef, { quantity: currentQuantity + quantity });
    } else {
      await setDoc(docRef, { quantity: quantity });
    }

    await updateInventory();
  }

  const filteredInventory = useMemo(() => {
    return inventory.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  useEffect(() => {
    updateInventory()
  }, [])

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const handleEditOpen = (item) => {
    setEditItem(item);
    setOpen(true);
  };

  const handleEditClose = () => {
    setEditItem(null);
    setOpen(false);
  };

  const handleFileUpload = async (event, itemName) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      if (!storage) {
        throw new Error('Firebase storage is not initialized');
      }

      const storageRef = ref(storage, `item-images/${itemName}`);

      const uploadResult = await uploadBytes(storageRef, file);

      const downloadURL = await getDownloadURL(uploadResult.ref);

      await setDoc(doc(firestore, 'stock', itemName), { photoURL: downloadURL }, { merge: true });

      await updateInventory();

    } catch (error) {
      console.error("Error in file upload process:", error);
      console.error("Error stack:", error.stack);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (itemName) => {
    await setDoc(doc(firestore, 'stock', itemName), { photoURL: null }, { merge: true });
    await updateInventory();
  };

  const handleCapture = async (photoDataUrl) => {
    try {
      const response = await fetch('/api/recognizeObject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoDataUrl }),
      });
      const data = await response.json();

      console.log('API response:', data);

      if (data.item && typeof data.item === 'string') {
        await addItem(data.item, 1);
        setShowCamera(false);
      } else {
        alert('Unable to recognize item. Please try again.');
      }
    } catch (error) {
      console.error("Error recognizing object:", error);
      alert('An error occurred while trying to recognize the object. Please try again.');
    }
  };

  return (
    <Box className={styles.backgroundContainer} width="100vw" height="100vh" display="flex" flexDirection="column" justifyContent="center" alignItems="center" gap={2}>
      <Box
        width="100%"
        bgcolor="rgba(245, 234, 220, 0.6)"
        py={3}
        position="absolute"
        top={0}
        left={0}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        px={4}
      >
        <Typography variant="h2" color="#523107" fontWeight="bold">
          Pantry Stock
        </Typography>
        {user ? (
          <Link
            component="button"
            variant="h6"
            onClick={() => auth.signOut()}
            sx={{
              color: "rgba(184, 134, 70, 1)",
              textDecoration: "none",
              '&:hover': {
                textDecoration: "underline",
              }
            }}
          >
            Sign Out
          </Link>
        ) : (
          <Link
            component="button"
            variant="h6"
            onClick={() => router.push('/account/signin')}
            sx={{
              color: "#523107",
              textDecoration: "none",
              '&:hover': {
                textDecoration: "underline",
              }
            }}
          >
            Sign In/Sign Up
          </Link>
        )}
      </Box>

      <Box mt={12}>
        <Modal open={open} onClose={editItem ? handleEditClose : handleClose}>
          <Box position="absolute" top="50%" left="50%" sx={{ transform: 'translate(-50%, -50%)' }} width={400} bgcolor="white" border="2px solid #000" boxShadow={24} p={4} display="flex" flexDirection="column" gap={3}>
            <Typography variant="h6" align="center">{editItem ? 'Edit Item' : 'Add Item'}</Typography>
            {editItem ? (
              <>
                <TextField
                  type="number"
                  variant="outlined"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1 }}
                  sx={{ width: '80px', alignSelf: 'center' }}
                />
                <Box display="flex" justifyContent="space-between" width="100%">
                  <Button variant="outlined" onClick={() => {
                    addItem(editItem.name, editQuantity);
                    handleEditClose();
                  }}>Add</Button>
                  <Button variant="outlined" onClick={() => {
                    removeItem(editItem.name, editQuantity);
                    handleEditClose();
                  }}>Remove</Button>
                </Box>
              </>
            ) : (
              <Stack w="100%" direction="row" spacing={2}>
                <TextField variant="outlined" fullWidth value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" />
                <Button variant="outlined" onClick={() => {
                  addItem(itemName);
                  setItemName('');
                  handleClose();
                }}>Add</Button>
              </Stack>
            )}
          </Box>
        </Modal>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={handleOpen}
            sx={{ bgcolor: "#523107", '&:hover': { bgcolor: "#3e2505" } }}
          >
            Add New Item
          </Button>
          <Button
            variant="contained"
            onClick={() => setShowCamera(true)}
            sx={{ bgcolor: "#523107", '&:hover': { bgcolor: "#3e2505" } }}
          >
            Add Item By Taking A Picture
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          width: "800px",
          mb: 2,
          overflow: "hidden",
          borderRadius: "75px",
          bgcolor: "#f5eadc",
          display: "flex",
          alignItems: "center",
          border: "5px solid #523107",
        }}
      >
        <TextField
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search items..."
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                border: 'none',
              },
            },
            '& .MuiInputBase-input': {
              padding: '15px 20px',
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#b88646',
              opacity: 1,
            },
          }}
        />
      </Box>

      <Box
        border="5px solid #523107"
        borderRadius="50px"
        overflow="hidden"
        sx={{
          width: "800px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          height="100px"
          bgcolor="#f5eadc"
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="75px"
          margin="10px"
        >
          <Typography variant="h2" color="#b88646">Inventory Items</Typography>
        </Box>

        <Stack height="300px" spacing={2} overflow="auto" padding={2}>
          {filteredInventory.map(({ name, quantity, photoURL }) => (
            <Box
              key={name}
              width="100%"
              display="flex"
              minHeight="150px"
              justifyContent="space-between"
              alignItems="center"
              bgcolor="#f5eadc"
              padding={5}
              borderRadius="75px"
              overflow="hidden"
            >
              <Box display="flex" alignItems="center" gap={2} flexGrow={1}>
                <Typography variant="h3" color="#b88646" textAlign="left">
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </Typography>
                {photoURL && (
                  <Image
                    src={photoURL}
                    alt={name}
                    width={100}
                    height={100}
                    objectFit="cover"
                    style={{ borderRadius: '10px' }}
                  />
                )}
              </Box>
              <Typography variant="h3" color="#b88646" textAlign="center" sx={{ minWidth: '100px' }}>{quantity}</Typography>
              <Box display="flex" alignItems="center">
                <Button
                  variant="contained"
                  onClick={() => handleEditOpen({ name, quantity })}
                  sx={{
                    bgcolor: "#523107",
                    '&:hover': { bgcolor: "#3e2505" },
                    mr: 1,
                    height: '30px',
                    width: '80px',
                    padding: '5px',
                    writingMode: 'horizontal-tb',
                  }}
                >
                  Edit
                </Button>
                <Stack direction="column" spacing={1}>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id={`upload-photo-${name}`}
                    type="file"
                    onChange={(e) => handleFileUpload(e, name)}
                  />
                  <label htmlFor={`upload-photo-${name}`}>
                    <Button
                      variant="contained"
                      component="span"
                      disabled={uploading}
                      sx={{ bgcolor: "#523107", '&:hover': { bgcolor: "#3e2505" }, width: '100%' }}
                    >
                      {uploading ? 'Uploading...' : 'Add Photo'}
                    </Button>
                  </label>
                  <Button
                    variant="contained"
                    onClick={() => handleRemovePhoto(name)}
                    sx={{ bgcolor: "#523107", '&:hover': { bgcolor: "#3e2505" }, width: '100%' }}
                  >
                    Remove Photo
                  </Button>
                </Stack>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      {showCamera && (
        <CameraComponent
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
          addItem={addItem}
        />
      )}
    </Box>
  )
}