const express = require("express");
const fs = require("fs");
const archiver = require("archiver");
const rimraf = require("rimraf");
const path = require("path");
const bodyParser = require("body-parser");
const util = require("util");

const app = express();
const port = 3002;

app.use(bodyParser.urlencoded({ extended: true }));

// Define the directories and their corresponding routes
const directories = [
  { path: path.join(process.cwd(), ".."), route: "/" },
  {
    path: path.join(process.cwd(), "../www"),
    route: "/www",
  },
  {
    path: path.join(process.cwd(), "../www/html"),
    route: "/www/html",
  },
  {
    path: path.join(process.cwd(), "../www/public_web"),
    route: "/www/public_web",
  },
  {
    path: path.join(process.cwd(), "../www/public_web/nodeProjects"),
    route: "/www/public_web/nodeProjects",
  },
  {
    path: path.join(process.cwd(), "../www/public_web/srninfotech"),
    route: "/www/public_web/srninfotech",
  },
  {
    path: path.join(process.cwd(), "../www/public_web/srninfotech/blog"),
    route: "/www/public_web/srninfotech/blog",
  },
  {
    path: path.join(process.cwd(), "../www/public_web/srninfotech/projects"),
    route: "/www/public_web/srninfotech/projects",
  },
  {
    path: path.join(process.cwd(), "../www/public_web/srninfotech/public_html"),
    route: "/www/public_web/srninfotech/public_html",
  },
  {
    path: path.join(
      process.cwd(),
      "../www/public_web/srninfotech/public_html/projects"
    ),
    route: "/www/public_web/srninfotech/public_html/projects",
  },
  {
    path: path.join(
      process.cwd(),
      "../www/public_web/srninfotech/public_html/ravindra"
    ),
    route: "/www/public_web/srninfotech/public_html/ravindra",
  },
];

function createZipArchive(sourceDir, destinationFile, selectedItems) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinationFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Iterate through selected items
    selectedItems.forEach((item, index) => {
      const itemPath = path.join(sourceDir, item);
      if (fs.existsSync(itemPath)) {
        if (fs.lstatSync(itemPath).isDirectory()) {
          // Add selected directory and its contents to the ZIP
          archive.directory(itemPath, item);
        } else {
          // Add selected file to the ZIP
          archive.file(itemPath, { name: item });
        }
      }

      // If it's the last item, finalize the archive
      if (index === selectedItems.length - 1) {
        archive.finalize();
      }
    });
  });
}

// Function to delete selected files and folders
function deleteSelectedItems(directory, selectedItems) {
  selectedItems.forEach((item) => {
    const itemPath = path.join(directory, item);
    if (fs.existsSync(itemPath)) {
      if (fs.lstatSync(itemPath).isDirectory()) {
        // Delete directory and its contents
        rimraf.sync(itemPath);
      } else {
        // Delete file
        fs.unlinkSync(itemPath);
      }
    }
  });
}

// Function to get all child directories of a given directory
function getChildDirectories(directory) {
  return fs
    .readdirSync(directory)
    .filter((item) => fs.lstatSync(path.join(directory, item)).isDirectory());
}

// Function to generate the HTML form for a given directory
function generateForm({ route, childDirectories, files }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Download and Delete Directory</title>
    </head>
    <body>
        <h1>Download and Delete Directory</h1>
        <form method="post" action="${route}">
            <h2>Files and Folders:</h2>
            <ul>
                ${
                  childDirectories
                    ? childDirectories
                        .map(
                          (dir) =>
                            `<li><input type="checkbox" name="selected_items[]" value="${dir}">${dir}/</li>`
                        )
                        .join("")
                    : ""
                }
                ${
                  files
                    ? files
                        .map(
                          (file) =>
                            `<li><input type="checkbox" name="selected_items[]" value="${file}">${file}</li>`
                        )
                        .join("")
                    : ""
                }
            </ul>
            <input type="submit" name="download" value="Download Selected">
            <input type="submit" name="delete" value="Delete Selected" onclick="return confirm('Are you sure you want to delete the selected items?')">
        </form>
    </body>
    </html>
  `;
}

// Generate routes for each directory
directories.forEach(({ path: directoryPath, route }) => {
  app.get(route, (req, res) => {
    // Read the directory contents
    const items = fs.readdirSync(directoryPath);
    const childDirectories = getChildDirectories(directoryPath);
    const files = items.filter((item) =>
      fs.lstatSync(path.join(directoryPath, item)).isFile()
    );

    res.send(generateForm({ route, childDirectories, files }));
  });

  app.post(route, async (req, res) => {
    const selectedItems = req.body.selected_items || [];

    // Check if the user clicked the "Download" button
    if (req.body.download) {
      const zipFileName = "backup.zip";

      // Create a ZIP archive of the selected items in the directory
      try {
        await createZipArchive(directoryPath, zipFileName, selectedItems);

        // Download the ZIP file
        if (fs.existsSync(zipFileName)) {
          res.setHeader("Content-Type", "application/zip");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${zipFileName}"`
          );

          // Stream the file to the response
          const fileStream = fs.createReadStream(zipFileName);
          fileStream.pipe(res);

          // Delete the ZIP file after sending it to the client
          fileStream.on("close", () => {
            fs.unlinkSync(zipFileName);
          });

          return;
        } else {
          res.send("Failed to create ZIP archive.");
          return;
        }
      } catch (error) {
        res.send("Failed to create ZIP archive.");
        return;
      }
    }

    // Check if the user clicked the "Delete Selected" button
    if (req.body.delete) {
      // Delete selected files and folders in the directory
      deleteSelectedItems(directoryPath, selectedItems);
    }

    res.redirect(route);
  });
});

const allRoutes = directories
  .map(({ route }) => `<a href="${route}">${route}</a>`)
  .join("<br>");

app.get("/routes", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>All Routes</title>
    </head>
    <body>
        <h1>All Routes</h1>
        ${allRoutes}
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
