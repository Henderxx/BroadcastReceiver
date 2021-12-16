const commands = require('./commands')
require('dotenv').config()
const PORT = process.env.RECEIVER_PORT
const MCAST_ADDR = '239.255.255.250'
const dgram = require('dgram')
const net = require('net')
const mysql = require('mysql')
let existingCards = new Map()
let lastPersonId = []
let newCards = new Map()
let newIds = []


const db = mysql.createConnection({
    host: process.env.DB_HOST,
    //socketPath: process.env.DB_SOCKET,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWD,
    database: process.env.DB_DATABASE
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
            commands.saveDataToLog(data,'received')
        const Txt = data.toString('utf8')
        aktual(existingCards,newCards,newIds)
            console.log(`Ilośc kart w pamięci: ${existingCards.size}`);
            console.log(`Ilosc wpisow lastpersonId: ${lastPersonId.length}`);
            console.log(`Żądana karta --- ${Txt}`)
        // console.log(`existing cards =========================`);
        // console.log(existingCards);
        // console.log(`personIds =========================`);
        // console.log(lastPersonId);
        // console.log(`new cards =========================`);
        // console.log(newCards);
            if(existingCards.has(Txt)) {
                console.log(`Jest karta w pamięci`)
                const znalezionaKarta = existingCards.get(Txt)
                console.log(`**********${znalezionaKarta}**********`);
                socket.write(znalezionaKarta)

                commands.saveDataToLog(znalezionaKarta,'send')
            }
            else {
                console.log(`Nie znaleziono wpisu w pamięci, ponowne odczytywanie bazy`)
                socket.write(`False`)
                try {
                    let maxId = 0
                    if(lastPersonId instanceof Array) {
                        maxId = Math.max(...lastPersonId)
                    }
                    commands.getMoreCards(db,maxId, addCards)
                    
                } catch (error) {
                    console.log(error);
                }
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


localReceiver.listen(PORT, () =>
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
    try {
        commands.readInterfaces()
        commands.goBackupInterfaces()
        commands.getExistingCards(db, logges)
        
    } catch (error) {
        console.log(error);
    }
    
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
            await commands.changeIPAddress(newIp,newNetmask,newGateway)
            break
        case 'setdhcp':
            await commands.setToDHCP()
            break
        case 'reboot':
            await commands.goReboot()
            break

        default:
            // receiver.send(`Ping pong ping`, rinfo.port, MCAST_ADDR,(error,bytes)=> {
            //     if(error) return console.log(error.stack)
            // })
            console.log(receivedPacket);
            break
    }
})

function addCards(error,foundCards,foundIds) {
    console.log(`=======Dodawanie nowych kart=======`);
    newCards = foundCards
    newIds = foundIds
return
}

function logges(error,foundCards,foundIds) {
    console.log(`=======Odczyt istniejacych kart=======`);
    existingCards = foundCards
    lastPersonId = foundIds
}

function aktual(exCards,neCards,neIds){
    console.log(`=======aktualizacja pamięci kart=======`)
    for(let [key, value] of neCards) {
        if (!exCards.has(key)) {
            existingCards.set(key, value)
        }
    }
    neIds.forEach(element => {
        if(!lastPersonId.includes(element)){
            lastPersonId.push(element)
        }
    });
}