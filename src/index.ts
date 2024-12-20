import * as dcmjs from "dcmjs"

let l = dcmjs.log;

//const a: string = `hello wide world - ${dcmjs.log.getLevel()}`
const a: string = `hello wide world - ${l.currentLevel}`

function getLog() {
    return dcmjs.log.currentLevel;
}

function apply(organizeOptions) {
    console.log(organizeOptions);
}

export { getLog, apply };

export default a
