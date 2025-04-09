import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


let scene, camera, renderer, currentObject, controls;
let voxelsPerUnit = 6;

const models = {
    heart: '/voxelize/models/heart.glb',
    romboid: '/voxelize/models/romboid.glb',
    ring: '/voxelize/models/ring.glb',
    cone: '/voxelize/models/cone.glb',
    monkey: '/voxelize/models/monkey.glb',
    sphere: '/voxelize/models/sphere.glb',
};

loadModel('heart'); 

init();


function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3;

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 20, 10);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.update();  

    window.addEventListener('resize', onWindowResize);

    document.getElementById('size-select').addEventListener('change', (e) => {
        changeVoxelsPerUnit (e.target.value);
    });

    document.getElementById('object-select').addEventListener('change', (e) => {
        loadModel(e.target.value);
    });

    document.getElementById('voxelize').addEventListener('click', voxelize);

    animate();
}


function centerObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());

    object.position.sub(center);
}


function changeVoxelsPerUnit(size) {
    voxelsPerUnit = size;
}


function loadModel(name) {
    const loader = new GLTFLoader();
    const path = models[name];
    
    
    if (currentObject) {
        scene.remove(currentObject);
        clearScene();
    }
    loader.load(path, (gltf) => {   
        currentObject = gltf.scene;
        centerObject(currentObject);
        scene.add(currentObject);
    });
}


function animate() {
    requestAnimationFrame(animate);
    controls.update();

    renderer.render(scene, camera);    
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


function clearScene() {
    scene.children.slice().forEach((child) => {
        if (child.isMesh) {
            scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });
}


function getDimensions(object) {
    let boundingBox = new THREE.Box3()
    let boundingBoxSize = new THREE.Vector3();

    boundingBox.setFromObject(object).getSize(boundingBoxSize);

    return {
        x: Math.ceil(boundingBoxSize.x),
        y: Math.ceil(boundingBoxSize.y),
        z: Math.ceil(boundingBoxSize.z),
    };
}


function doesVoxelIntersectObject(x, y, z, size) {
    const xVector = new THREE.Vector3(1, 0, 0);
    const yVector = new THREE.Vector3(0, 1, 0);
    const zVector = new THREE.Vector3(0, 0, 1);

    const halfSize = size/2

    const leftFaceCorners = [
        new THREE.Vector3(x-halfSize, y-halfSize, z-halfSize),
        new THREE.Vector3(x-halfSize, y-halfSize, z+halfSize),
        new THREE.Vector3(x-halfSize, y+halfSize, z-halfSize),
        new THREE.Vector3(x-halfSize, y+halfSize, z+halfSize),
    ];

    const bottomFaceCorners = [
        new THREE.Vector3(x-halfSize, y-halfSize, z-halfSize),
        new THREE.Vector3(x+halfSize, y-halfSize, z-halfSize),
        new THREE.Vector3(x-halfSize, y-halfSize, z+halfSize),
        new THREE.Vector3(x+halfSize, y-halfSize, z+halfSize),
    ];

    const backFaceCorners = [
        new THREE.Vector3(x-halfSize, y-halfSize, z-halfSize),
        new THREE.Vector3(x+halfSize, y-halfSize, z-halfSize),
        new THREE.Vector3(x-halfSize, y+halfSize, z-halfSize),
        new THREE.Vector3(x+halfSize, y+halfSize, z-halfSize),
    ];


    const raycaster = new THREE.Raycaster();
    
    for (let corner of leftFaceCorners) {
        raycaster.set(corner, xVector);
        const intersects = raycaster.intersectObject(currentObject, true);

        if (intersects.length > 0 && intersects[0].distance <= size) {
            return true;
        }
    }

    for (let corner of bottomFaceCorners) {
        raycaster.set(corner, yVector);
        const intersects = raycaster.intersectObject(currentObject, true); 
        if (intersects.length > 0 && intersects[0].distance <= size) {
            return true;
        }
    }

    for (let corner of backFaceCorners) {
        raycaster.set(corner, zVector);
        const intersects = raycaster.intersectObject(currentObject, true); 
        if (intersects.length > 0 && intersects[0].distance <= size) {
            return true;
        }
    }

    return false;
}


function calculateCoordinates(index, gridSize) {
    const voxelSize = 1 / voxelsPerUnit;
    const halfGridSize = gridSize / 2;
    const halfVoxelSize = voxelSize / 2;

    return (index - halfGridSize) * voxelSize + halfVoxelSize;

}


function calculateGrid(sizeX, sizeY, sizeZ) {
    const grid = new Array();
    for (let i = 0; i <= sizeX; i++) {
        grid[i] = new Array();

        for (let j = 0; j <= sizeY; j++) {
            grid[i][j] = new Array();   

            for (let k = 0; k <= sizeZ; k++) {

                const x = calculateCoordinates(i, sizeX);
                const y = calculateCoordinates(j, sizeY);
                const z = calculateCoordinates(k, sizeZ);
                grid[i][j][k] = {
                    value: doesVoxelIntersectObject(x, y, z, 1/voxelsPerUnit),
                    x: x,
                    y: y,
                    z: z,
                }
            }
        }
    }
    
    return grid
}


function drawGrid(sizeX, sizeY, sizeZ, grid, material) {
    for (let i = 0; i <= sizeX; i++) {
    
        for (let j = 0; j <= sizeY; j++) {
    
            for (let k = 0; k <= sizeZ; k++) {
                if (grid[i][j][k].value) {

                    const geometry = new THREE.BoxGeometry(1/voxelsPerUnit, 1/voxelsPerUnit, 1/voxelsPerUnit );
                    const voxel = new THREE.Mesh(geometry, material);
    
                    scene.add(voxel);
                    voxel.position.set(grid[i][j][k].x, grid[i][j][k].y, grid[i][j][k].z);
                }
            }
        }
    }
}


function voxelize() {
    let dimensions = getDimensions(currentObject);

    const sizeX = dimensions.x * voxelsPerUnit;
    const sizeY = dimensions.y * voxelsPerUnit;
    const sizeZ = dimensions.z * voxelsPerUnit;


    let grid = calculateGrid(sizeX, sizeY, sizeZ);

    let material;
    currentObject.traverse((child) => {
        if (child.isMesh && child.material) {
            material = child.material.clone();
        }
    });

    if (currentObject) {
        scene.remove(currentObject);
        clearScene();
    }
    

    drawGrid(sizeX, sizeY, sizeZ, grid, material);
}