
const sendXLSXFileToServer = async (file) => {
    const formData = new FormData();
    formData.append('xlsxFile', file);

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData,
        });

        console.log('Response:', response);

        // File was successfully sent to the server
        const responseText = await response.text(); // or response.json() if expecting JSON
        console.log('Server response: :at frontend', responseText);
        alert(responseText)
        document.getElementById('downloadLinks').style.display = 'block';

    } catch (error) {
        console.error('An error occurred:', error);
    }
};
