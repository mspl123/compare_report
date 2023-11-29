
const add_data = async (input1Value, input2Value) => {
    console.log("here");
    console.log(input1Value, input2Value);

    const requestData = {
        mst_remote_station_id: input1Value,
        dam_id: input2Value,
    };

    try {
        const response = await fetch('http://localhost:3000/insertData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
        });

        // Assuming you are checking if the response is okay based on HTTP status
        if (response.ok) {
            const resultData = await response.json();
            console.log(resultData.message); // Log the result message if needed
        } else {
            const errorResponse = await response.json();
            console.error('Failed to insert data into tables:', errorResponse.message);

            // Display the error message to the user
            alert(errorResponse.message);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
};
