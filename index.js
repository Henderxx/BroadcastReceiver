const commands = require('./commands')
const PORT = '9000'
const MCAST_ADDR = '239.255.255.250'
const dgram = require('dgram')
const net = require('net')
const mysql = require('mysql')
let existingCards = new Map()
let lastPersonId = []
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
            commands.saveDataToLog(data,'received')
        const Txt = data.toString('utf8')
        console.log(`Text --- ${Txt}`)
        try {
            if(existingCards.has(Txt)) {
                console.log(`Jest karta w pamięci`)
                console.log(`Ilośc kart w pamięci: ${existingCards.size}`);
                console.log(`Ilosc wpisow lastpersonId: ${lastPersonId.length}`);
                //socket.write(existingCards[Txt])

                //commands.saveDataToLog(existingCards[Txt],'send')
            }
            else {
                console.log(`Nie znaleziono wpisu w pamięci, ponowne odczytywanie bazy`)
                socket.write(`False`)
                try {
                    let maxId = 0
                    if(lastPersonId instanceof Array) {
                        maxId = Math.max(...lastPersonId)
                    }
                    await commands.getMoreCards(db,maxId, addCards)
                    
                   
                } catch (error) {
                    console.log(error);
                }
            }
        } catch (error) {
            console.log(error)
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


//let {existingCards, lastPersonId} = commands.getExistingCards(db)
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
        await commands.getExistingCards(db, logges)
        
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

//console.log(foundCards);
console.log(`foundIds: ${foundIds}`);
}

function logges(error,foundCards,foundIds) {
    // foundCards.forEach((value) => {
    //     console.log(`==========`);
    //     console.log(`value: ${value}`);
    //     console.log(`==========`);
    //     //console.log(`key: ${key}`);
    // })
    existingCards = map([...existingCards, ...foundCards])
    console.log(existingCards);
}

//setInterval(commands.getExistingCards(db,logges),10000)