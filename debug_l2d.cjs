
const fs = require('fs');
const path = require('path');

try {
    const l2dPath = path.join(process.cwd(), 'public/pio/static/l2d.js');
    const content = fs.readFileSync(l2dPath, 'utf8');
    
    const searchStr = 'hitTestSimpleCustom=function';
    const index = content.indexOf(searchStr);
    
    if (index === -1) {
        console.log('Function not found');
    } else {
        // Print 500 characters starting from the function definition
        console.log(content.substring(index, index + 800));
    }
} catch (err) {
    console.error(err);
}
