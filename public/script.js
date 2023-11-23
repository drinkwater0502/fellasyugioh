const draggables = document.querySelectorAll('.draggable')
const containers = document.querySelectorAll('.container')

draggables.forEach(draggable => {
  draggable.addEventListener('dragstart', () => {
    draggable.classList.add('dragging')
  })

  draggable.addEventListener('dragend', () => {
    draggable.classList.remove('dragging')
  })
})

containers.forEach(container => {
  container.addEventListener('dragover', e => {
    e.preventDefault()
    const afterElement = getDragAfterElement(container, e.clientX)
    const draggable = document.querySelector('.dragging')
    if (afterElement == null) {
      container.appendChild(draggable)
    } else {
      container.insertBefore(draggable, afterElement)
    }
  })
})

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')]

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect()
    const offset = y - box.left - box.width / 2
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child }
    } else {
      return closest
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// get all cards currently on page (after pressing save)
let saveButton = document.getElementById('saveDeckButton')
saveButton.addEventListener('click', function () {
  let inventoryCards = document.querySelectorAll('#inventoryID img')
  let mainDeckCards = document.querySelectorAll('#maindeckID img')
  let extraDeckCards = document.querySelectorAll('#extradeckID img')
  let sideDeckCards = document.querySelectorAll('#sidedeckID img')
  let inventoryArray = Array.from(inventoryCards).map(p => p.alt)
  let mainDeckArray = Array.from(mainDeckCards).map(p => p.alt)
  let extraDeckArray = Array.from(extraDeckCards).map(p => p.alt)
  let sideDeckArray = Array.from(sideDeckCards).map(p => p.alt)
  fetch('/sendData', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inventoryData: inventoryArray, mainDeckData: mainDeckArray, extraDeckData: extraDeckArray, sideDeckData: sideDeckArray }),
  })
  .then(response => {
    if (response.ok) {
        // Redirect to the desired path after a successful response
        window.location.href = '/cards';
    } else {
        console.error('Failed to send data to the server');
    }
  })
  .catch(error => {
      console.error('Error:', error);
  });
})

