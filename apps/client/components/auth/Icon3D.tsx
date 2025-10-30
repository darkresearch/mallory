import React, { Suspense, useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useGLTF, PerspectiveCamera } from '@react-three/drei/native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';

interface Icon3DProps {
  modelPath: any; // Asset module from require()
  size?: number;
  rotationSpeed?: number;
}

function Model({ uri, rotationSpeed = 1 }: { uri: string; rotationSpeed?: number }) {
  const { scene } = useGLTF(uri);
  const meshRef = useRef<THREE.Group>(null);
  
  // Clone the scene to avoid sharing materials between instances
  const clonedScene = React.useMemo(() => scene.clone(), [scene]);
  
  // Continuous Y-axis rotation animation
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Apply tilts for a dynamic floating look
      meshRef.current.rotation.x = -Math.PI / 6; // 30° tilt away from viewer
      meshRef.current.rotation.z = -Math.PI / 12; // 15° tilt to the left
      
      // Y rotation continues and animates
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });
  
  return <primitive ref={meshRef} object={clonedScene} scale={1.5} />;
}

export function Icon3D({ modelPath, size = 140, rotationSpeed = 0.8 }: Icon3DProps) {
  const [assetUri, setAssetUri] = useState<string | null>(null);

  useEffect(() => {
    const loadAsset = async () => {
      try {
        // Load the asset and get its URI
        const asset = Asset.fromModule(modelPath);
        await asset.downloadAsync();
        setAssetUri(asset.localUri || asset.uri);
      } catch (error) {
        console.error('Failed to load 3D model:', error);
      }
    };

    loadAsset();
  }, [modelPath]);

  if (!assetUri) {
    return <View style={[styles.container, { width: size, height: size }]} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          {/* Lighting - enhanced for better 3D effect */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1.2} />
          <directionalLight position={[-10, -10, -5]} intensity={0.4} />
          <pointLight position={[0, 5, 0]} intensity={0.3} />
          
          {/* Camera */}
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          
          {/* 3D Model with rotation */}
          <Model uri={assetUri} rotationSpeed={rotationSpeed} />
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

