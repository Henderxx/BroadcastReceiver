const fs = require('fs');
const receivedIP = '192.168.0.245'
const receivedMask = '255.255.254.0'
const receivedGateway = '192.168.0.1'

fs.readFile(__dirname+'/interfaces', {encoding: 'utf-8', flag: 'r'}, (err, data) => {
    if(err) return console.log(err.message)

    let start_string = 'auto eth0'
    let file_content = data.toString()
    let strToWrite = `
iface eth0 inet static
    address ${receivedIP}
    netmask ${receivedMask}
    gateway ${receivedGateway}`

    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = strToWrite.length + idx
    let result = file_content.slice(0,idx) + strToWrite + file_content.slice(endidx)

    fs.writeFile(__dirname+'/interfaces_edited',result,{encoding: 'utf-8'}, (err) =>{console.log(err.message)})
})