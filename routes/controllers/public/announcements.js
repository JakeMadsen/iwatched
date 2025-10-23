module.exports = function(server){
  // List page
  server.get('/announcements', (req, res) => {
    res.render('public assets/template.ejs', {
      page_title: 'Announcements',
      page_file: 'temp_announcements',
      page_subFile: 'list',
      page_data: {},
      user: req.user
    });
  });

  // Detail page
  function renderOne(req, res){
    // Be resilient if the route matched "/announcements/:id" with a slug appended
    // Extract the ObjectId-like segment before the first dash if present
    const raw = (req.params && req.params.id) ? String(req.params.id) : '';
    const safeId = raw.split('-')[0];
    res.render('public assets/template.ejs', {
      page_title: 'Announcement',
      page_file: 'temp_announcements',
      page_subFile: 'one',
      page_data: { id: safeId },
      user: req.user
    });
  }

  // slugged route first to avoid :id capturing
  server.get('/announcements/:id-:slug', renderOne);
  server.get('/announcements/:id', renderOne);
}
