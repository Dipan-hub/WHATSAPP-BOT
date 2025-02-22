const { exec } = require('child_process');
const readline = require('readline');

// Create a readline interface to get input from the user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to execute git commands
function executeGitCommand(command, description) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during ${description}: ${stderr}`);
        reject(error);
      } else {
        console.log(`${description}: ${stdout}`);
        resolve(stdout);
      }
    });
  });
}

// Function to ask for commit hash
function askCommitHash() {
  return new Promise((resolve) => {
    rl.question('Enter the commit hash you want to reset to: ', (commitHash) => {
      resolve(commitHash);
      rl.close();
    });
  });
}

// Reset to the given commit hash
async function resetRepo() {
  try {
    const commitHash = await askCommitHash();

    if (!commitHash) {
      console.log('No commit hash provided. Exiting.');
      return;
    }

    console.log(`Resetting the repository to commit ${commitHash}...`);
    
    // Checkout the desired commit
    await executeGitCommand(`git checkout ${commitHash}`, 'Checkout Commit');
    
    // Reset the local branch to match the commit (discard all changes after that commit)
    await executeGitCommand(`git reset --hard ${commitHash}`, 'Hard Reset');
    
    // Force push the commit to the origin (GitHub)
    await executeGitCommand(`git push origin main --force`, 'Push to GitHub');
    
    // Force push the commit to Heroku
    await executeGitCommand(`git push heroku main --force`, 'Push to Heroku');

    await executeGitCommand(`git checkout main`, 'Welcome to main');
    
    console.log('Repository is now reset, and changes are pushed to both GitHub and Heroku.');
  } catch (error) {
    console.error('There was an error while resetting the repository:', error);
  }
}

// Start the reset process
resetRepo();


// How to run this
// node git-reset.js