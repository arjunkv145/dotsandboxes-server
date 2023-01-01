const express = require('express')
const app = express()
const port = 3030

app.get('/', (req, res) => {
    res.send('Welcome to dots and boxes multiplayer game!')
})

app.listen(port, () => console.log(`listening at port ${port}`))