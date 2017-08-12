/**
 * Created by magnus on 2017-01-18.
 */

let assert = require('chai').assert;
let RestService = require("../index");
let restService = new RestService("http://crm","admin","admin");
const guid = require("guid");
const fs = require("fs");

describe('RestService', function ()
{
    describe('getSessionId', function ()
    {
        it('Should always return a session id', function (done)
        {
            restService.getSessionId().then(function (sessionId)
            {
                try
                {
                    assert.isDefined(sessionId);
                    assert.lengthOf(sessionId, 26, "Id has 26 chars");
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            }, function (err)
            {
                console.error(err);
                done(new Error(err));
            });
        });

        it("Should not fetch new sessionId", function (done)
        {
            restService.sessionId = "test123";
            restService.getSessionId().then(function (sessionId)
            {
                try
                {
                    assert.equal("test123", sessionId);
                    restService.sessionId = undefined;
                    done();
                }
                catch (e)
                {
                    done(e);
                }
            }, function (err)
            {
                done(new Error(err));
            });

        });
    });
    describe("CRUD", () =>
    {

        it("delete entry: Should throw error on faulty id", done =>
        {
            restService.deleteEntry("Accounts", "oodsfkghifdortiyjtro546546756").then(x =>
            {
                done(new Error("Should never come here.."));
            }).catch(x => done())
        });

        it("getEntry should throw error on faulty id", done =>
        {
            restService.getEntry("Accounts", "oodsfkghifdortiyjtro546546756").then(x =>
            {
                console.error(x);
                done(new Error("Should never come here.."));
            }).catch(x => done())
        });

        it("Should save entry", function (done)
        {
            let accName = guid.create();
            //TODO: Add cleanup :)
            restService.saveEntry("Accounts", {name: accName, description: "Description"}).then(function (id)
            {
                try
                {
                    assert.isDefined(id);
                    restService.getEntry("Accounts", id).then(acc =>
                    {
                        try
                        {
                            assert.equal(accName, acc.name);
                            assert.equal("Description", acc.description);
                            restService.deleteEntry("Accounts", id);
                            done();
                        }
                        catch (e)
                        {
                            done(e);
                        }
                    }).catch(done);
                }
                catch (e)
                {
                    done(e);
                }
            }, function (e)
            {
                done(e);
            });
        });
        it("Should yield object from namevalue list", function ()
        {
            assert.deepEqual({
                warning: "YOur face asplode",
                deleted: "1"
            }, restService.fromNameValueList([{"name": "warning", "value": "YOur face asplode"},
                {"name": "deleted", "value": "1"}]));
        });
        it("Should yield name-valuelist from object ", function ()
        {
            assert.deepEqual([{"name": "warning", "value": "YOur face asplode"},
                {"name": "deleted", "value": "1"}], restService.toNameValueList({
                warning: "YOur face asplode",
                deleted: "1"
            }));
        });

        it("Should remove entry", function (done)
        {
            let accName = guid.create();
            restService.saveEntry("Accounts", {name: accName, description: "Description"}).then(function (id)
            {
                try
                {
                    assert.isDefined(id);
                    restService.deleteEntry("Accounts", id).then(res =>
                    {
                        restService.getEntry("Accounts", id).then(function (data)
                        {
                            done(new Error("Should not find entry"));
                        }).catch(err =>
                        {
                            assert.instanceOf(err, Error, "Reject object is instance of error");
                            done()
                        });
                    },done).catch(done);

                }
                catch (e)
                {
                    done(e);
                }
            }, function (e)
            {
                done(e);
            });
        });


        it("Should save all of them", done =>
        {
            let accs = [];
            for(let i = 0;i<10;i++)
            {
                accs.push({name:guid.create()});
            }
            restService.saveEntries("Accounts",accs).then(ids =>
            {
                //assert there are many ids.
                assert(ids.length==10);
                ids.reduce((seq,id) =>
                {
                    return seq.then(() => restService.deleteEntry("Accounts",id));
                },Promise.resolve()).then(() => done());
            });
        });


        it("Should relate the records",done =>
        {
            let clean = (contactId,accountId) =>
            {
                restService.deleteEntry("Contacts",contactId).then(x=>
                {
                    return restService.deleteEntry("Accounts",accountId);
                }).then(x =>
                {
                    done();
                });
            };
            restService.saveEntry("Accounts", {name: guid.create(), description: "Description"}).then(accountId =>
            {
                restService.saveEntry("Contacts", {first_name: guid.create(), description: "dasContact"}).then(contactId =>
                {
                    restService.setRelationship("Accounts",accountId,"contacts",contactId).then(() =>
                    {
                        restService.setRelationship("Contacts",contactId,"accounts",accountId).then(() =>
                        {
                            //use get_relationship to assert that the relationship was created
                            restService.getRelationship("Accounts",accountId,"contacts").then(data =>
                            {
                                try
                                {
                                    assert.equal(contactId,data[0].id);
                                }
                                catch(e)
                                {
                                    clean(contactId,accountId);
                                    done(e);
                                }
                                return restService.getRelationship("Contacts",contactId,"accounts")
                            }).then(data =>
                            {
                                try
                                {
                                    assert.equal(accountId,data[0].id);
                                    clean(contactId,accountId);
                                }
                                catch(e)
                                {
                                    clean(contactId,accountId);
                                    done(e);
                                }
                            });
                        });
                    });

                });
            });
        });

        it("Should return empty list",done =>
        {
           restService.getRelationship("Derp",guid.create(),"ee").then(data=>
           {
               assert.fail("Should not succeed");
           }).catch(er=>
           {
               assert.isDefined(er);
               done();
           });
        });
        //specific to my crm instance..
        xit("should create historisk data relationship",done=>
        {

            let clean = (histoId,accountId) =>
            {
                restService.deleteEntry("histo_Historical_Data",histoId).then(x=>
                {
                    return restService.deleteEntry("Accounts",accountId);
                }).then(x =>
                {
                    done();
                });
            };
            restService.saveEntry("histo_Historical_Data",{name:"TestHistoricalData",description:"Description"}).then(histoId =>
            {
                restService.saveEntry("Accounts",{name:guid.create(),description:"hehe"}).then(accountId =>
                {
                    restService.setRelationship("Accounts",accountId,"histo_historical_data_accounts",histoId).then(()=>
                    {
                        restService.setRelationship("histo_Historical_Data",histoId,"histo_historical_data_accounts",accountId).then(() =>
                        {
                            restService.getRelationship("Accounts",accountId,"histo_historical_data_accounts").then(data =>
                            {
                                try
                                {
                                    assert.equal(histoId,data[0].id);
                                }
                                catch(e)
                                {
                                    clean(histoId,accountId);
                                    done(e);
                                }
                                return restService.getRelationship("histo_Historical_Data",histoId,"histo_historical_data_accounts")
                            }).then(data =>
                            {
                                try
                                {
                                    assert.equal(accountId,data[0].id);
                                    clean(histoId,accountId);
                                }
                                catch(e)
                                {
                                    clean(histoId,accountId);
                                    done(e);
                                }
                            });
                        })
                    })
                })
            })
        });

        it("Should create document with data",done =>
        {
            restService.saveEntry("Documents",
                {
                    document_name:"Pia Olsson",
                    date_entered:"2016-12-28",
                    description:'CS - Spiral barnsäkert' + "\n\n" + 'Carl-Henrik Skotte'
                }).then((id)=>
            {
                restService.setDocumentRevision(id, fs.readFileSync('test/testfile.txt'),"testfile.txt").then((res) =>
                {
                    assert.isDefined(res.id);
                    return restService.getDocumentRevision(res.id).then((res2)=>
                    {
                        assert.equal("Hello world",new Buffer(res2.file, 'base64').toString('ascii'));
                        assert.equal("testfile.txt",res2.filename);
                        assert.equal("1",res2.revision);
                        assert(res2.document_name.indexOf("Pia Olsson")!==-1);

                    }).then(() =>
                    {
                        console.dir(id);
                        restService.deleteEntry("Documents",id).then(()=>{done();});
                    }).catch(done);
                });
            });
        });

        it("Should save the document",done =>
        {
            restService.saveDocument("Derpie","DESCRIPTION",fs.readFileSync('test/testfile.txt'),"testfile.txt","2013-04-23").then((id) =>
            {
                restService.getRelationship("Documents",id,"revisions").then((res)=>
                {
                    let revId = res[0].id;
                    return restService.getDocumentRevision(revId).then((res2)=>
                    {
                        assert.equal("Hello world",new Buffer(res2.file, 'base64').toString('ascii'));
                        assert.equal("testfile.txt",res2.filename);
                        assert.equal("1",res2.revision);
                        assert(res2.document_name.indexOf("Derpie")!==-1);

                    }).then(() =>{
                        restService.deleteEntry("Documents",id).then(()=>
                        {
                            done();
                        });
                    }).catch(done);
                });


            })
        });

        /**
         * If this test fails make sure to check these php.ini settings in the environment you're running this against:
         * upload_max_filesize = 100M
         * post_max_size = 20M
         *
         */
        it("Should be able to handle a bigger file",done=>
        {
            restService.saveDocument("DA BIG ONE","DESCRIPTION",fs.readFileSync('test/bigfile.jpg'),"bigfile.jpg").then((id) =>
            {
                restService.getRelationship("Documents",id,"revisions").then((res)=>
                {
                    let revId = res[0].id;
                    return restService.getDocumentRevision(revId).then((res2)=>
                    {
                        assert(res2.file.length>10000);
                        assert.equal("bigfile.jpg",res2.filename);
                        assert.equal("1",res2.revision);
                        assert(res2.document_name.indexOf("DA BIG ONE")!==-1);

                    }).then(() =>{
                        restService.deleteEntry("Documents",id).then(()=>
                        {
                            done();
                        });
                    }).catch(done);
                });
            });
        }).timeout(15000);
    });


});