const PORT = '9000'
const MCAST_ADDR = '239.255.255.250'
const dgram = require('dgram')
const net = require('net')
const fs = require('fs')
//const sourceFile = '/etc/network/interfaces'
const sourceFile = __dirname+'/interfaces'
const backupFile = __dirname+'/backup/interfaces.bak'
const logFile = __dirname+'/logs/connections.log'
const { exec }= require('child_process')
const mysql = require('mysql')
let readyIntFile = {}
let existingCards = {}
//let Person = ''


const db = mysql.createConnection({
    host: '192.168.0.26',
    //socketPath: '/run/mysql/mysql.sock',
    user: 'ifter',
    password: 'ifter',
    database: 'sysora'
})

db.connect(function(err){
    if (err) {
        console.log(`Błąd połączenia z bazą: ${err.stack}`)
        return
    }
    console.log(`połączono z bazą jako id: ${db.threadId}`);
})
const localReceiver = net.createServer()

localReceiver.on('connection', (socket) => {
    const newClient = `${socket.remoteAddress}:${socket.remotePort}`
    console.log(`Nowe połączenie: ${newClient}`)

    socket.on('data',async (data) => {
        console.log(data)
        //zapis do pliku czas + otrzymany pakiet
        saveReceivedDataLog(data)
        //Person = ''
        const Txt = data.toString('utf8')
        console.log(`Text --- ${Txt}`);
        try {
            if(existingCards[Txt]) {
                console.log(existingCards[Txt]);
                socket.write(existingCards[Txt])
            }
            else {
                console.log(`Nie znaleziono wpisu w pamięci, ponowne odczytywanie bazy`);
                socket.write(`False`)
                await getExistingCards()
            }
            //await getPersons(Txt,socket)
            //socket.write(Person)
            
        } catch (error) {
            console.log(error);
        }
        
    })

    socket.on('close', () => {
        console.log(`Connection closed`);
    })

    socket.on('error', (err) => {
        console.log(err.message);
    })
}) 


localReceiver.on('error', (err) =>{
    throw err
})


localReceiver.listen(9000, () =>
console.log(`server bound`)
)



const receiver = dgram.createSocket({type: 'udp4', reuseAddr: true})

receiver.bind(PORT, () => {
    receiver.setBroadcast(true)
    //receiver.setMulticastTTL(128)
    receiver.addMembership(MCAST_ADDR)
})
receiver.on('listening',() => {
    const address = receiver.address()
    console.log(`Serwer zaczal nasluchiwac na ${address.address} na porcie ${address.port}`)
})

receiver.on('error', (err) => {
    console.log(`receiver error: \n ${err.stack}`);
    receiver.close()
})
receiver.once('listening', async () =>{
    readInterfaces()
    goBackupInterfaces()
    await getExistingCards()
})

receiver.on('message',async (msg, rinfo) => {
    const output = `Serwer UDP otrzymal message: ${msg} \n z ${rinfo.address}:${rinfo.port} \n`
        let receivedPacket = msg.toString().slice(0).trim().split(/ +/)
        const command = receivedPacket[0]
    process.stdout.write(output)

    switch (command) {
        case 'halo':
            receiver.send(`otrzymałem wiadomość panie klienterze`, rinfo.port, MCAST_ADDR,(error,bytes)=> {
                if(error) return console.log(error.stack)
            })
            break
        case 'setip':
            //setip 192.168.0.26 netmask 255.255.255.0 gateway 192.168.0.1
            const newIp = receivedPacket[1]
            const newNetmask = receivedPacket[3]
            const newGateway = receivedPacket[5]
            await changeIPAddress(newIp,newNetmask,newGateway)
            break
        case 'setdhcp':
            await setToDHCP()
            break
        case 'reboot':
            await goReboot()
            break

        default:
            // receiver.send(`Ping pong ping`, rinfo.port, MCAST_ADDR,(error,bytes)=> {
            //     if(error) return console.log(error.stack)
            // })
            console.log(receivedPacket);
            break
    }
})

async function changeIPAddress(newIp,newNetmask,newGateway) {
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = readyIntFile.toString()
    let strToWrite = `
iface eth0 inet static
    address ${newIp}
    netmask ${newNetmask}
    gateway ${newGateway}

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)
    let result = file_content.slice(0,idx) + strToWrite + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},raisErr)
    console.log(`Zapisano zmiany w pliku, nowe ip zostanie zmienione po restarcie urzadzenia`)
}
async function setToDHCP(){
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = readyIntFile.toString()
    let strToWriteDhcp = `
iface eth0 inet dhcp

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)// - end_string.length
    let result = file_content.slice(0,idx) + strToWriteDhcp + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},raisErr)
    console.log(`Zapisano zmiany w pliku,IP zostanie zmienione na DHCP po restarcie urzadzenia`)
}
async function goReboot(){
    exec('reboot', (error,stdout,stderr) =>{
        if(error) {
            console.log(`error: ${error.message}`)
            return
        }
        if(stderr) {
            console.log(`stderr: ${stderr}`)
            return
        }
        console.log(`going to reboot. Bye`);
    })
}
function readInterfaces(){
    return fs.readFile(sourceFile,{encoding:'utf-8'}, (err, data) =>{
        if(err) return console.log(err.name);
        readyIntFile = data
    })
}
function goBackupInterfaces(){
    return fs.copyFile(sourceFile, backupFile, fs.constants.COPYFILE_FICLONE, raisErr)
}
function raisErr(err){
    if (err) throw err
}
async function getPersons(cardId, socket) {
    const query = `SELECT person.name FROM card join person on person.id = card.personid where physid=${cardId}`
    db.query(query ,( error, results,fields) => {
        if (error) throw error
    const Person = results[0].name
        console.log(`Result: ${results[0].name}`);
    socket.write(Person)
    //zapis do pliku czasu wysłanego pakietu
    saveSendDataLog(Person)
    })
}



function saveReceivedDataLog(data){
    const date = new Date()
    const year = date.getFullYear()
    const month = date.getMonth() +1
    const day = date.getDate()
    const HH = date.getHours()
    const MM = date.getMinutes()
    const SS = date.getSeconds()

    const result = `${year}.${month}.${day}-${HH}:${MM}:${SS} Received Data >> ${data} \r\n`

    fs.writeFile(logFile,result,{encoding: 'utf-8', 'flag': 'a'},raisErr)
}

function saveSendDataLog(data){
    const date = new Date()
    const year = date.getFullYear()
    const month = date.getMonth() +1
    const day = date.getDate()
    const HH = date.getHours()
    const MM = date.getMinutes()
    const SS = date.getSeconds()

    const result = `${year}.${month}.${day}-${HH}:${MM}:${SS} Send Data << ${data} \r\n`

    fs.writeFile(logFile,result,{encoding: 'utf-8','flag': 'a'},raisErr)
}

function getExistingCards() {
    const query = 'select person.name,card.physid from card join person on person.id = card.personid'
    db.query(query, (error, results, fields) => {
        if (error) {
            throw error
        }
    for (const res of results) {
        existingCards[res.physid] = res.name
    }
    // console.log(`Results: ${results}`);
    console.log(JSON.stringify(existingCards));
    })
}