import { TTS, leerMensajes, skipAudio } from './functions/tts.js';
import { fetchvoicelist } from './utils/select.js';
let isReading = null;
var voiceSelect = document.createElement('select');

document.addEventListener('DOMContentLoaded', () => {
    window.api.onShowMessage((event, message) => {
        console.log(message);
    });
    setTimeout(async () => {
        var voiceSelectContainer = document.getElementById('voiceSelectContainer');
        voiceSelectContainer.appendChild(voiceSelect);
        fetchvoicelist().then(data => {

            Object.keys(data).forEach(function(key) {
                var option = document.createElement('option');
                option.text = key;
                option.value = data[key];
                voiceSelect.appendChild(option);
                // console.log(key, data[key]);
            });
        });
      }, 1000);
    const dropArea = document.getElementById('drop-area');
    const fileList = document.getElementById('file-list');

    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropArea.classList.add('highlight');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('highlight');
    });
    document.getElementById("testvoicebtn").addEventListener("click", function() {
        const messages = document.getElementById("testvoice").value;
        handleleermensaje(messages);
    });
    async function handleleermensaje(text) {
        const selectedVoice = document.querySelector('input[name="selectvoice"]:checked');
        const selectedCommentType = document.querySelector('input[name="comment-type"]:checked').value;
        
        
            let shouldRead = false;
            
            if (selectedCommentType === 'any-comment') {
                shouldRead = true;
            } else if (selectedCommentType === 'dot-comment' && text.startsWith('.')) {
                shouldRead = true;
            } else if (selectedCommentType === 'slash-comment' && text.startsWith('/')) {
                shouldRead = true;
            } else if (selectedCommentType === 'command-comment') {
                const commandPrefix = document.getElementById('command').value;
                if (text.startsWith(commandPrefix)) {
                    shouldRead = true;
                    text = text.replace(commandPrefix, '');
                }
            }

            if (shouldRead && text && !isReading) {
             if (selectedVoice.id === 'selectvoice2') {
                new TTS(text);
            } else if (selectedVoice.id === 'selectvoice1') {
                leerMensajes(text);
            }
        }

        return true;
    }

    let existingFiles = JSON.parse(localStorage.getItem('existingFiles')) || [];
    dropArea.addEventListener('drop', async (event) => {
        event.preventDefault();
        dropArea.classList.remove('highlight');

        const files = event.dataTransfer.files;
        for (const file of files) {
            console.log('info:', file); // Aquí se imprime el path o la URL del archivo
            console.log('file.existingFiles', existingFiles);
            let fileExists = existingFiles.some(existingFile => 
                existingFile.name === file.name && existingFile.size === file.size
            );

            if (fileExists) {
                console.log(`El archivo "${file.name}" ya existe y tiene el mismo tamaño.`);
                alert(`El archivo "${file.name}" ya existe y tiene el mismo tamaño.`);
                continue;
            }

            if (file.path) {
                // Si el archivo tiene un path, no es necesario leerlo como Data URL
                const fileParams = { fileName: file.name, filePath: file.path };
                const confirmation = confirm(`¿Desea agregar el archivo "${file.name}"?`);
                if (confirmation) {
                    const result = await window.api.addFilePath(fileParams);
                    if (result.success) {
                        addFileToLocalStorage(fileParams);
                        loadFileList();
                    } else {
                        alert(`Error al agregar el archivo: ${result.error}`);
                    }
                }
            } else {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const fileParams = { fileToAdd: e.target.result, fileName: file.name };
                    const confirmation = confirm(`¿Desea agregar el archivo "${file.name}"?`);
                    if (confirmation) {
                        const result = await window.api.addFilePath(fileParams);
                        if (result.success) {
                            loadFileList();
                            addFileToLocalStorage(fileParams);

                        } else {
                            alert(`Error al agregar el archivo: ${result.error}`);
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    });
    const addFileToLocalStorage = (fileParams) => {
        existingFiles.push(fileParams);
        localStorage.setItem('existingFiles', JSON.stringify(existingFiles));
    };
    const loadFileList = async () => {
        const files = await window.api.getFilesInFolder();
        existingFiles = files;
        localStorage.setItem('existingFiles', JSON.stringify(existingFiles));
        console.log('loadFileList', files);
        fileList.innerHTML = files.map(file => `
            <div class="file-item">
                <span>${file.name}</span>
                <button onclick="deleteFile('${file.name}')">Delete</button>
                <button class="play-button">Play</button>
                ${getMediaElement(file.path, file.type)}
            </div>
        `).join('');
    };

    const getMediaElement = (filePath, fileType) => {
        if (fileType) {
            if (fileType.startsWith('image/')) {
                return `<img src="${filePath}" class="file-thumbnail" />`;
            } else if (fileType.startsWith('video/')) {
                return `<video controls class="file-thumbnail">
                            <source src="${filePath}" type="${fileType}">
                            Your browser does not support the video tag.
                        </video>`;
            } else if (fileType.startsWith('audio/')) {
                return `<audio controls class="file-thumbnail">
                            <source src="${filePath}" type="${fileType}">
                            Your browser does not support the audio tag.
                        </audio>`;
            } else {
                return `<span>Unsupported file type</span>`;
            }
        } else {
            return `<img src="${filePath}" class="file-thumbnail" />`;
        }
    };

    window.deleteFile = async (fileName) => {
        await window.api.deleteFile(fileName);
        existingFiles = existingFiles.filter(file => file.fileName !== fileName);
        localStorage.setItem('existingFiles', JSON.stringify(existingFiles));
        loadFileList();
    };

    let overlayPage = null; // Variable para almacenar la referencia a la ventana emergente

    fileList.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON' && target.classList.contains('play-button')) {
            const fileItem = target.closest('.file-item');
            const fileIndex = Array.from(fileItem.parentNode.children).indexOf(fileItem);
            const file = existingFiles[fileIndex];
            console.log('file', file);
            // Additional data to be sent with the event
            const additionalData = { example: 'additional data' };
            try {
                await window.api.createOverlayWindow();
                await window.api.sendOverlayData('play', { src: file.path, fileType: file.type, additionalData });
                console.log('Overlay event sent');
            } catch (error) {
                console.error('Error sending overlay event:', error);
            }
        } else if (target.tagName === 'BUTTON' && target.textContent === 'Delete') {
            const fileItem = target.closest('.file-item');
            const fileName = fileItem.querySelector('span').textContent;
            deleteFile(fileName);
        }
    });
    
    
    
    function addOverlayEvent(eventType, data) {
        if (!overlayPage || overlayPage.closed) {
            overlayPage = window.open('overlay.html', 'transparent', 'width=auto,height=auto,frame=false,transparent=true,alwaysOnTop=true,nodeIntegration=no');

        }
        setTimeout(() => {
            try {
                overlayPage.postMessage({ eventType, indexData: data }, '*');
            } catch (err) {
                console.error('Error sending message to overlayPage:', err);
            }
        }, 500);
    }

    loadFileList();
    // document.getElementById('connect-button').addEventListener('click', async () => {
    //     const result = await window.api.createClientOsc();

    //     if (result.success) {
    //         console.log('OSC Client created successfully');
    //     } else {
    //         console.error('Failed to create OSC Client');
    //     }
    // });
    document.getElementById('createBotForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        // ipExample = "localhost:25565";
        const keyBOT = document.getElementById('keyBOT').value.trim();
        const keySERVER = document.getElementById('keySERVER').value.trim();
        serverip = keySERVER.split(':')[0];
        serverport = keySERVER.split(':')[1] || 25565;
        const keyLOGIN = document.getElementById('keyLOGIN').value.trim();
        const resultMessage = document.getElementById('resultMessage');

        const options = {
            host: serverip,
            port: serverport,
            username: keyBOT,
        };
        console.log('options', options);
        const result = await window.api.createBot(options);
        if (result.success) {
            console.log('Bot created successfully');

            window.api.onBotEvent((event, type, data) => {
                if (type === 'login') {
                    console.log('Bot logged in');
                    window.api.sendChatMessage(`${keyBOT} ${keyLOGIN}`);
                } else if (type === 'chat') {
                    console.log(`${data.username}: ${data.message}`);
                    if (data.message === 'hello') {
                        window.api.sendChatMessage('Hello there!');
                    }
                }
                console.log(result);
                resultMessage.textContent = result.message;
                console.log('%cEl bot está conectado', 'color: green');
                resultMessage.style.color = 'green';

            });
        } else {
            console.error('Failed to create bot');
            console.log('%cEl bot está desconectado', 'color: red');
            resultMessage.style.color = 'red';
        }
    });

});


