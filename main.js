import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSphericalCatan } from './spherical-catan.js';

document.addEventListener('DOMContentLoaded', () => {
    const game = createSphericalCatan('catan-container', THREE, OrbitControls);
}); 