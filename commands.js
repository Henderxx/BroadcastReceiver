const fs = require('fs')
const logFile = __dirname+'/logs/connections.log'
//const sourceFile = '/etc/network/interfaces'
const sourceFile = __dirname+'/interfaces'
const backupFile = __dirname+'/backup/interfaces.bak'
const { exec }= require('child_process')

module.exports = {
   // existingCards: {},
    readyIntFile: {},
   // lastPersonId: 0,
    queryDatabase: async function queryDatabase(db,query,callback) {
        db.query(query,(error,data) =>{
        if(error) return callback(error,null)
        callback(null,data)
        })
    },
    getExistingCards: async function getExistingCards(db, callback) {
        const query = 'select person.id,person.name,card.physid from card join person on person.id = card.personid limit 10'
        let personIds = []
        let existingCards = new Map()
            await this.queryDatabase(db,query,(error,data) => {
                if(error) return callback(error,null)
                for(const row of data) {
                    existingCards.set(row.physid, row.name )
                    personIds.push(Number(row.id))
                }
            })
        console.log(`initial odczyt kart`);
        callback(null,existingCards,personIds)
    },

    getMoreCards : async function getMoreCards(db,lastPersonId,callback) {
        const query = `select person.id,person.name,card.physid from card join person on person.id = card.personid where person.id > ${lastPersonId} limit 5`
        let foundIds =[]
        let foundCards = new Map()
            this.queryDatabase(db,query,(error, data) => {
                if(error){
                    return callback(error,null)
                }
                for(const row of data) {
                    foundCards.set(row.physid, {'name': row.name, 'id': row.id} )
                    foundIds.push(Number(row.id))
                }
            })
        console.log('poszlo doczytanie kart')
        //return {existingCards, lastPersonId}
        return callback(null,foundCards, foundIds)
    },

    raisErr: function raisErr(err){
        if (err) throw err
    },

    saveDataToLog: function saveDataToLog(data,direction){
        const date = new Date()
        const year = date.getFullYear()
        const month = date.getMonth() +1
        const day = date.getDate()
        const HH = date.getHours()
        const MM = date.getMinutes()
        const SS = date.getSeconds()

        if(direction === 'received') {
            const result = `${year}.${month}.${day}-${HH}:${MM}:${SS} Received Data >> ${data} \r\n`
            fs.writeFile(logFile,result,{encoding: 'utf-8','flag': 'a'},this.raisErr)
        }
        
        const result = `${year}.${month}.${day}-${HH}:${MM}:${SS} Send Data << ${data} \r\n`
        fs.writeFile(logFile,result,{encoding: 'utf-8','flag': 'a'},this.raisErr)
        
        
    },

    goBackupInterfaces: function goBackupInterfaces(){
        return fs.copyFile(sourceFile, backupFile, fs.constants.COPYFILE_FICLONE, this.raisErr)
    },

    readInterfaces: function readInterfaces(){
        fs.readFile(sourceFile,{encoding:'utf-8'}, (err, data) =>{
            if(err) return console.log(err.name);
            return readyIntFile = data
        })
    },

    goReboot: async function goReboot(){
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
    },

    
changeIPAddress: async function changeIPAddress(newIp,newNetmask,newGateway) {
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = this.readyIntFile.toString()
    let strToWrite = `
iface eth0 inet static
    address ${newIp}
    netmask ${newNetmask}
    gateway ${newGateway}

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)
    let result = file_content.slice(0,idx) + strToWrite + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},this.raisErr)
    console.log(`Zapisano zmiany w pliku, nowe ip zostanie zmienione po restarcie urzadzenia`)
},

setToDHCP: async function setToDHCP(){
    await readInterfaces()
    let start_string = 'auto eth0'
    let end_string = 'auto wlan0'
    let file_content = this.readyIntFile.toString()
    let strToWriteDhcp = `
iface eth0 inet dhcp

`
    const idx = file_content.indexOf(start_string) + start_string.length
    const endidx = file_content.indexOf(end_string)// - end_string.length
    let result = file_content.slice(0,idx) + strToWriteDhcp + file_content.slice(endidx)
    fs.writeFile(sourceFile,result,{encoding: 'utf-8'},this.raisErr)
    console.log(`Zapisano zmiany w pliku,IP zostanie zmienione na DHCP po restarcie urzadzenia`)
}

}