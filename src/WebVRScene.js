var THREE = require("three");
import WebVRPolyfill from "webvr-polyfill";
import VRControls from "three-vrcontrols-module";
import VREffect from "three-vreffect-module";
import RendererStats from "@xailabs/three-renderer-stats";
import Stats from "stats-js";
import GLTFLoader from 'three-gltf-loader';
var PointerLockControls = require('three-pointerlock');

const testImg = require('./textures/test.png');
const centerImg = require('./textures/center.jpg');
const sideImg = require('./textures/side.jpg');
const cubeImgs = [
    require('./textures/cubemap/px.png'),
    require('./textures/cubemap/nx.png'),
    require('./textures/cubemap/py.png'),
    require('./textures/cubemap/ny.png'),
    require('./textures/cubemap/pz.png'),
    require('./textures/cubemap/nz.png')
];

export default class WebVRScene {
  constructor() {
    // Get config from URL
    var config = (function() {
      var config = {};
      var q = window.location.search.substring(1);
      if (q === "") {
        return config;
      }
      var params = q.split("&");
      var param, name, value;
      for (var i = 0; i < params.length; i++) {
        param = params[i].split("=");
        name = param[0];
        value = param[1];
        // All config values are either boolean or float
        config[name] =
          value === "true"
            ? true
            : value === "false"
            ? false
            : parseFloat(value);
      }
      return config;
    })();

    var polyfill = new WebVRPolyfill(config);
    console.log(
      "Using webvr-polyfill version " +
        WebVRPolyfill.version +
        " with configuration: " +
        JSON.stringify(config)
    );
    var renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(Math.floor(window.devicePixelRatio));

    // Append the canvas element created by the renderer to document body element.
    var canvas = renderer.domElement;
    document.body.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    // Add camera to a group so the camera can be moved
    var camHeight = 10
    var user = new THREE.Group();
    user.add(camera);
    scene.add(user);
    user.position.setY(camHeight)
    // Apply VR stereo rendering to renderer.
    var effect = new VREffect(renderer);
    effect.setSize(canvas.clientWidth, canvas.clientHeight, false);
    var vrDisplay, controls;
    // Raycaster to move teleport marker
    var raycaster = new THREE.Raycaster();
    // Request animation frame loop function
    var lastRender = 0;
    // The polyfill provides this in the event this browser
    // does not support WebVR 1.1
    // If we have a native display, or we have a CardboardVRDisplay
    // from the polyfill, use it
    // Otherwise, we're on a desktop environment with no native
    // displays, so provide controls for a monoscopic desktop view
    var isVR = false;
    navigator.getVRDisplays().then(function(vrDisplays) {
      if (vrDisplays.length) {
        vrDisplay = vrDisplays[0];
        // Apply VR headset positional data to camera.
        controls = new VRControls(camera);
        // Kick off the render loop.
        vrDisplay.requestAnimationFrame(animate);
        isVR = true;
      } else {
        // Add a button for full screen and vr
        controls = new PointerLockControls(camera);
        // Disable the "Enter VR" button
        var enterVRButton = document.querySelector('#vr');
        enterVRButton.disabled = true;
        // Kick off the render loop.
        requestAnimationFrame(animate);
      }
    });

    // Resize the WebGL canvas when we resize and also when we change modes.
    window.addEventListener("resize", onResize);
    window.addEventListener("vrdisplaypresentchange", onVRDisplayPresentChange);
    window.addEventListener("vrdisplayconnect", onVRDisplayConnect);
    /// Button click handlers.
    document
      .querySelector("button#fullscreen")
      .addEventListener("click", function() {
        enterFullscreen(renderer.domElement);
      });
    document.querySelector("button#vr").addEventListener("click", function() {
      vrDisplay.requestPresent([{ source: renderer.domElement }]);
    });
    // Mouse Events
    var bodyElement = document.querySelector("Body");
    bodyElement.addEventListener("click", () => {
      console.log("click");
    });
    // Gamepad events
    var gamepad = null;
    var gamepadIndex = 0;
    window.addEventListener("gamepadconnected", function(e) {
      console.log(
        "Gamepad connected at index %d: %s. %d buttons, %d axes.",
        e.gamepad.index,
        e.gamepad.id,
        e.gamepad.buttons.length,
        e.gamepad.axes.length
      );
      gamepad = e.gamepad;
      if (gamepad) {
        if (gamepad.mapping === "standard") {
          console.log("Standard Gamepad");
        } else if (
          gamepad.pose &&
          gamepad.pose.hasOrientation &&
          gamepad.pose.hasPosition
        ) {
          console.log("6DOF: Pointing and position");
        } else if (gamepad.pose && gamepad.pose.hasOrientation) {
          console.log("3DOF: Pointing only");
        } else {
          console.log("0DOF Clicker, or other");
        }
      }
    });
    window.addEventListener("gamepaddisconnected", function(e) {
      console.log(
        "Gamepad disconnected from index %d: %s",
        e.gamepad.index,
        e.gamepad.id
      );
    });


    
    if (process.env.NODE_ENV == "development") {
      // RenderStats
      var rendererStats = new RendererStats();
      rendererStats.domElement.style.position = "absolute";
      rendererStats.domElement.style.left = "0px";
      rendererStats.domElement.style.bottom = "0px";
      document.body.appendChild(rendererStats.domElement);
      // Stats
      var stats = new Stats();
      stats.showPanel(1); // 0: fps, 1: ms, 2: mb, 3+: custom
      document.body.appendChild(stats.dom);
      // Three JS  Inspector
      window.scene = scene;
      window.THREE = THREE;
    }

    if (!("ongamepadconnected" in window)) {
      // No gamepad events available, poll instead.
      // interval = setInterval(pollGamepads, 500);
      console.log("no gamepad events available");
    }

    const cubeTex = new THREE.CubeTextureLoader().load(cubeImgs);
    cubeTex.format = THREE.RGBFormat;
    scene.background = 0x000000;
    var fogColor = 0xffffff;
    scene.fog = new THREE.Fog(fogColor, 150, 500);
    // Load textures
    var textureLoader = new THREE.TextureLoader();
    var testTex = textureLoader.load(testImg)
    var testMat = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true}); 
    var centerTex = textureLoader.load(centerImg);
    centerTex.flipY = false;
    centerTex.encoding = THREE.sRGBEncoding;
    var sideTex = textureLoader.load(sideImg);
    sideTex.encoding = THREE.sRGBEncoding;
    sideTex.flipY = false;
    var centerMat = new THREE.MeshBasicMaterial({map: centerTex, envMap: cubeTex, combine: THREE.MixOperation,reflectivity: 0.2})          
    var sideMat = new THREE.MeshBasicMaterial({map: sideTex});
    var navmesh = null;
    // Load a glTF resource
    var loader = new GLTFLoader();
    loader.load(
        // resource URL
        `./assets/duveen_gallery.glb`,
        // called when the resource is loaded   
            ( gltf ) => {
                console.log(gltf);
                gltf.scene.children.forEach(child => {
                    console.log(child.name)
                    child.material = testMat;
                    switch (child.name) {
                        case 'side':
                            child.material = sideMat;
                            break;
                        case 'side001':
                            child.material = sideMat;
                            break;
                        case 'center':
                            child.material = centerMat;
                            break;
                        case 'navmesh':
                            navmesh = child;
                            child.renderOrder = -1;
                            break;
                    }
                });
                // gltf.scene.position.setY(camHeight * -1);
                scene.add(gltf.scene);
                gltf.animations; // Array<THREE.AnimationClip>
                gltf.scene; // THREE.Scene
                gltf.scenes; // Array<THREE.Scene>
                gltf.cameras; // Array<THREE.Camera>
                gltf.asset; // Object
        },
        // called while loading is progressing
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log(error);
        }
    );
    // Create cube to use as teleport marker
    var geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    var normalMat = new THREE.MeshNormalMaterial();
    var cube = new THREE.Mesh(geometry, normalMat);
    cube.visible = false;
    scene.add(cube);
    // Spacebar event for non vr input
    document.body.onkeyup = function(e){
        if(e.keyCode == 32){
            move();
        }
    }
    // Clock to get delta time for PointerLock
    var clock = new THREE.Clock();

    function move(){
      var cubePos = new THREE.Vector3();
      cube.getWorldPosition(cubePos);
      user.position.set(cubePos.x, cubePos.y + camHeight, cubePos.z);
      console.log(user.children);
    }
    function onResize() {
      // The delay ensures the browser has a chance to layout
      // the page and update the clientWidth/clientHeight.
      // This problem particularly crops up under iOS.
      if (!onResize.resizeDelay) {
        onResize.resizeDelay = setTimeout(function() {
          onResize.resizeDelay = null;
          console.log(
            "Resizing to %s x %s.",
            canvas.clientWidth,
            canvas.clientHeight
          );
          effect.setSize(canvas.clientWidth, canvas.clientHeight, false);
          camera.aspect = canvas.clientWidth / canvas.clientHeight;
          camera.updateProjectionMatrix();
        }, 250);
      }
    }
    function onVRDisplayPresentChange() {
      console.log("onVRDisplayPresentChange");
      onResize();
      buttons.hidden = vrDisplay.isPresenting;
    }
    function onVRDisplayConnect(e) {
      console.log(
        "onVRDisplayConnect",
        e.display || (e.detail && e.detail.display)
      );
    }
    function enterFullscreen(el) {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    }
    function pollGamepads() {
      var gamepads = navigator.getGamepads
        ? navigator.getGamepads()
        : navigator.webkitGetGamepads
        ? navigator.webkitGetGamepads
        : [];
      if (gamepads) {
        gamepad = gamepads[gamepadIndex];
        for (var i = 0; i < gamepads.length; ++i) {
          var gp = gamepads[i];
          if (gp) {
            var info = "";
            info =
              "Gamepad " +
              gp.index +
              " (" +
              gp.id +
              ")" +
              "Associated with VR Display ID: " +
              gp.displayId +
              " ";
            if (gp.hapticActuators) {
              info +=
                "Available haptic actuators: " + gp.hapticActuators.length;
            }
            if (gp.pose) {
              info += "Gamepad associated with which hand: " + gp.hand;
              info +=
                "Gamepad can return position info: " + gp.pose.hasPosition;
              info +=
                "Gamepad can return orientation info: " +
                gp.pose.hasOrientation;
            }
            if (gp.buttons) {
              for (var j = 0; j < gp.buttons.length; ++j) {
                var val = gp.buttons[i];
                var pressed = val == 1.0;
                if (typeof val == "object") {
                  pressed = val.pressed;
                  val = val.value;
                }
                submit = pressed;
                info += "Button " + j + ":" + pressed + " ";
              }
            } else {
              info += "No buttons. ";
            }
            if (gp.axes) {
              for (i = 0; i < gp.axes.length; i++) {
                if (gp.axes[i]) {
                  var a = gp.axes[i];
                  info += " " + i + ": " + gp.axes[i].toFixed(4);
                }
              }
            } else {
              info += "No axes. ";
            }
          }
          console.log(info);
        }
      }
    }
    function animate(timestamp) {
      // Stats
      if (process.env.NODE_ENV == "development") {
        stats.begin();
      }
      lastRender = timestamp;
      // Update VR headset position and apply to camera.
      if(isVR){
        controls.update();
      }else{
        var delta = clock.getDelta();
        controls.update(delta);
      }
      // Render the scene.
      effect.render(scene, camera);
      // Gamepad 
      var submit = false;
      var gamepads = navigator.getGamepads
        ? navigator.getGamepads()
        : navigator.webkitGetGamepads
        ? navigator.webkitGetGamepads
        : [];
      if (gamepads) {
        gamepad = gamepads[gamepadIndex];
        for (var i = 0; i < gamepads.length; ++i) {
          var gp = gamepads[i];
          if (gp) {
            var info = "";
            info =
              "Gamepad " +
              gp.index +
              " (" +
              gp.id +
              ")" +
              "Associated with VR Display ID: " +
              gp.displayId +
              " ";
            if (gp.hapticActuators) {
              info +=
                "Available haptic actuators: " + gp.hapticActuators.length;
            }
            if (gp.pose) {
              info += "Gamepad associated with which hand: " + gp.hand;
              info +=
                "Gamepad can return position info: " + gp.pose.hasPosition;
              info +=
                "Gamepad can return orientation info: " +
                gp.pose.hasOrientation;
            }
            if (gp.buttons) {
              for (var j = 0; j < gp.buttons.length; ++j) {
                var val = gp.buttons[i];
                var pressed = val == 1.0;
                if (typeof val == "object") {
                  pressed = val.pressed;
                  val = val.value;
                }
                submit = pressed;
                info += "Button " + j + ":" + pressed + " ";
              }
            } else {
              info += "No buttons. ";
            }
            if (gp.axes) {
              for (i = 0; i < gp.axes.length; i++) {
                if (gp.axes[i]) {
                  var a = gp.axes[i];
                  info += " " + i + ": " + gp.axes[i].toFixed(4);
                }
              }
            } else {
              info += "No axes. ";
            }
            // console.log(info);
          }
        }
      }
      // Raycast onto navmesh and move cube
      var wpVector = new THREE.Vector3();
      camera.getWorldPosition(wpVector);
      var wdVector = new THREE.Vector3();
      camera.getWorldDirection(wdVector);
      raycaster.set(wpVector, wdVector);
      if(navmesh){
        var intersects = raycaster.intersectObject(navmesh);
        if(intersects.length > 0){
          var hit = intersects[0].point;
          cube.position.set(hit.x, hit.y +1, hit.z);
          cube.visible = true;
        }else{
            cube.visible = false;
        }
      }
      if(submit){
        move();
      }
      // Keep looping; if using a VRDisplay, call its requestAnimationFrame,
      // otherwise call window.requestAnimationFrame.
      if (vrDisplay) {
        vrDisplay.requestAnimationFrame(animate);
      } else {
        requestAnimationFrame(animate);
      }
      // Stats
      if (process.env.NODE_ENV === "development") {
        rendererStats.update(renderer);
        stats.end();
      }
    }
  }
}
