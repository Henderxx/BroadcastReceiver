const M_CAST_ADDR = '239.255.255.255'
const LOCAL_ADDR = '192.168.0.90'
const PORT = '6564'
const dgram = require('dgram')
const libnmap = require('libnmap');

const options = {
    ports: '6564',
    range: ['192.168.0.0/23'],
    threshold: 2048, // maximum of 2048 child processes (depending on range & blocksize)
    timeout: 900, // 900s = 15m and increases the reliability of scan results
    udp: true, // requires root privileges
    // json: false, //report in xml
    flags: [
        '-sV' // Open port to determine service (i.e. FTP, SSH etc)
        // '-O', // OS finger printing (requires elevated privileges)
        // '-sC', // Enables the nmap scripts (all) against each host (requires elevated privileges)
        // '--traceroute', // Turns on tracerouting
        // '--script traceroute-geolocation' // Turns on GeoIP functionality per hops
        // '-T0', // Paranoid scan type; very slow but accurate
        // '--max-retries 10', // Don't give up on slow responding hosts
        // '--ttl 200ms', // Accomodate for slow connections by setting the packets TTL value higher
        // '--scan-delay 10s', // Account for host 'rate limiting'
        // '--max-rate 30', // Slows down packet spewing to account for IDS protections
    ]
}



const server = dgram.createSocket({type: 'udp4', reuseAddr: true})

server.bind(PORT, () => {
    server.setBroadcast(true)
    //server.setMulticastTTL(128)
    //server.addMembership(M_CAST_ADDR)
})

server.on('error', (err) => {
    console.log(`server error: \n ${err.stack}`);
    server.close()
})

server.on('message', (msg, rinfo) => {
    const output = `Serwer UDP otrzymal message: ${msg} \n z ${rinfo.address}:${rinfo.port} \n`
    process.stdout.write(output)
    if(msg.toString().startsWith('halo')) {
        server.send(`otrzymałem wiadomość panie klienterze`, rinfo.port, rinfo.address, (error)=> {console.log(error);})
    }
    if(msg.toString().startsWith('scan')) {
        console.log(`rozpoczynam skan`);
        
        libnmap.scan(options, (err,report) => {
            if (err) throw new Error(err)

            for( const item in report){
                console.log(JSON.stringify(repot[item], null, 2));
            }
        })
    }
})

server.on('listening', () => {
    const address = server.address()
    console.log(`Serwer zaczal nasluchiwac na ${address.address} na porcie ${address.port}`)
    // server.setBroadcast(true)
})