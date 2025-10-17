module.exports = function(server){
  // List page
  server.get('/announcements', (req, res) => {
    res.render('public assets/template.ejs', {
      page_title: 'Announcements',
      page_file: 'announcements',
      page_subFile: 'list',
      page_data: {},
      user: req.user
    });
  });

  // Detail page
  function renderOne(req, res){
    res.render('public assets/template.ejs', {
      page_title: 'Announcement',
      page_file: 'announcements',
      page_subFile: 'one',
      page_data: { id: req.params.id },
      user: req.user
    });
  }

  // slugged route first to avoid :id capturing
  server.get('/announcements/:id-:slug', renderOne);
  server.get('/announcements/:id', renderOne);
}
