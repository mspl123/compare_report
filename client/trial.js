const trialJS = async (val1) => {


    try {
        const response = await fetch('http://localhost:3000/testing', {
            method: 'POST',
            body: val1,
        });

        console.log('hi');

        // File was successfully sent to the server
        const responseText = await response.text(); // or response.json() if expecting JSON
        console.log('Server response:', responseText);

      

    } catch (error) {
        console.error('An error occurred:', error);
    }
};

trialJS();