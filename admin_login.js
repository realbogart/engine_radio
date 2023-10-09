document.getElementById('passwordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    var password = document.getElementById('password').value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            password: password
        })
    })
    .then(response => {
        if (!response.ok) {
            if(response.status === 401) {
                alert("Invalid password");
            } else {
                alert("Server error");
            }
            throw new Error('Request failed: ' + response.status);
        }
        return response.text();
    })
    .then(html => {
      window.location.href = '/admin';
    })
    .catch(error => {
        console.error("Error: ", error);
    });
});

