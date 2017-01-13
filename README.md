# engine_radio
friday music broadcasting madness

* Requires the request module: npm install request

# Docker
Build with:
```docker build -t engine_radio .```
Run with:
```docker run -p 80:1337 -p 81:1338 -it --rm --name cobrakai engine_radio```

Assumes you have icecast running on the same server on port 8000.
Start icecast using docker with:
```docker run -p 8000:8000 moul/icecast```

