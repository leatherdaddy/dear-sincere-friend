import Pace from "pace-progressbar";
// var Pace = require("pace-js");

Pace.start();

function getComponent(){
  return import(/* webpackChunkName: "webVrScene" */ './WebVRScene').then(({default: WebVRScene}) => {
    
    let example = new WebVRScene();
    
  }).catch(error => 'An error occured while loading the component');
}
const backgroundImage = require('./textures/cubemap/z+.jpg');
var body = document.querySelector("Body");
body.setAttribute('background', backgroundImage);

getComponent();

//I think this disables some touch events
document.addEventListener('touchmove', function(e) {
  e.preventDefault();
});



 